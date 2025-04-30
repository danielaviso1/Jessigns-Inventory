const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const app = express();

// Setup
const db = new sqlite3.Database('./db.sqlite3');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// File upload setup
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// DB tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS Products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT,
    price REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerName TEXT,
    productId INTEGER,
    quantity INTEGER,
    totalPrice REAL,
    dateOrdered TEXT,
    dateCommitted TEXT,
    status TEXT,
    file TEXT,
    FOREIGN KEY (productId) REFERENCES Products(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    itemName TEXT,
    category TEXT,
    quantity INTEGER,
    price REAL,
    location TEXT
  )`);
});

// Routes
app.get('/', (req, res) => {
    db.all("SELECT * FROM Products", (err, products) => {
      db.all("SELECT Orders.*, Products.product AS productName FROM Orders JOIN Products ON Orders.productId = Products.id", (err2, orders) => {
        db.get("SELECT COUNT(*) AS totalOrders, SUM(totalPrice) AS totalRevenue FROM Orders", (err3, summary) => {
          db.all("SELECT status, COUNT(*) AS count FROM Orders GROUP BY status", (err4, statusCounts) => {
            const statusSummary = { Pending: 0, Completed: 0 };
            statusCounts.forEach(row => statusSummary[row.status] = row.count);
  
            // Fetch inventory items
            db.all("SELECT * FROM Inventory", (err5, inventory) => {
              res.render('index', { products, orders, summary, statusSummary, inventory });
            });
          });
        });
      });
    });
  });

app.post('/add-order', upload.single('file'), (req, res) => {
  const { customerName, productId, quantity, dateOrdered, dateCommitted, status } = req.body;
  db.get("SELECT price FROM Products WHERE id = ?", [productId], (err, row) => {
    const totalPrice = row.price * quantity;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    db.run(`INSERT INTO Orders (customerName, productId, quantity, totalPrice, dateOrdered, dateCommitted, status, file)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerName, productId, quantity, totalPrice, dateOrdered, dateCommitted, status, filePath],
      () => res.redirect('/'));
  });
});

app.post('/add-product', (req, res) => {
  const { product, price } = req.body;
  db.run(`INSERT INTO Products (product, price) VALUES (?, ?)`, [product, price], () => res.redirect('/'));
});

app.post('/delete-order/:id', (req, res) => {
    db.run("DELETE FROM Orders WHERE id = ?", [req.params.id], () => res.redirect('/'));
  });

  app.post('/update-order/:id', upload.single('file'), (req, res) => {
    const { customerName, productId, quantity, dateOrdered, dateCommitted, status } = req.body;
    const id = req.params.id;
    
    db.get("SELECT price FROM Products WHERE id = ?", [productId], (err, row) => {
      const totalPrice = row.price * quantity;
      const filePath = req.file ? `/uploads/${req.file.filename}` : null;
  
      const sql = `UPDATE Orders SET 
        customerName = ?, productId = ?, quantity = ?, totalPrice = ?, 
        dateOrdered = ?, dateCommitted = ?, status = ? ${filePath ? ', file = ?' : ''} 
        WHERE id = ?`;
  
      const params = [
        customerName, productId, quantity, totalPrice,
        dateOrdered, dateCommitted, status,
        ...(filePath ? [filePath] : []),
        id
      ];
  
      db.run(sql, params, () => res.redirect('/'));
    });
  });

  app.post('/add-inventory', (req, res) => {
    const { itemName, category, quantity, price, location } = req.body;
    db.run(`INSERT INTO Inventory (itemName, category, quantity, price, location)
            VALUES (?, ?, ?, ?, ?)`, [itemName, category, quantity, price, location], () => {
      res.redirect('/');
    });
  });

  app.post('/update-inventory/:id', (req, res) => {
    const { itemName, category, quantity, price, location } = req.body;
    const id = req.params.id;
    db.run(`UPDATE Inventory SET 
            itemName = ?, category = ?, quantity = ?, price = ?, location = ?
            WHERE id = ?`, [itemName, category, quantity, price, location, id], () => {
      res.redirect('/');
    });
  });
  
  app.post('/delete-inventory/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM Inventory WHERE id = ?", [id], () => res.redirect('/'));
  });
  
  

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
