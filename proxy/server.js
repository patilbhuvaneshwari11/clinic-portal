const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const memorySanitizer = require('./memorySanitizer.js');
const tarpit = require('./tarpit.js');
const velocityBreaker = require('./velocityBreaker.js');
const patientRoutes = require('./patients.js');

const app = express();

app.use(cors());

// Parse incoming bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Defense Layer
app.use(memorySanitizer);
app.use(tarpit);
app.use(velocityBreaker);

// ClearShield Protected Routes
app.use('/api/patients', patientRoutes);

// Forward all other traffic to FastAPI
app.use('/', createProxyMiddleware({
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
}));

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🛡️ Middleware Proxy is active on http://localhost:${PORT}`);
    console.log(`➡️  Forwarding to FastAPI on http://127.0.0.1:8000`);
});