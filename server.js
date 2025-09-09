import express from "express";
import compression from "compression";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { createRequestHandler } from "@remix-run/express";
import https from "https";
import http from "https";
import session from "express-session";

// Import the Remix server build
import * as build from "./build/server/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Use compression middleware for performance
app.use(compression());

app.set('trust proxy', 1);

// Logging HTTP requests
app.use(morgan("tiny"));

// Secure headers for Shopify embedded apps
app.use((req, res, next) => {
  const shop = req.query.shop || "";
  if (shop !== '') {
    res.setHeader(
      'Content-Security-Policy',
      `frame-ancestors https://${shop} https://admin.shopify.com;`
    );
  }
  // res.setHeader("Access-Control-Allow-Origin", "*");
  // res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  next();
});


app.use(session({
  secret: "f5025d13ea32d106970342bbd773e14f880595791c797cb3295fe93804712468",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,           // Ensures the browser only sends the cookie over HTTPS
    sameSite: "none",       // Required for third-party cookies in embedded Shopify apps
    domain: "cro.ancestralsupplements.com" // Use your root domain
  }
}));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "build/client/")));
app.get("/privacy-policy", (req, res) => {
  return res.sendFile('./privacy-policy.html', { root: __dirname });
});

// All other requests go to Remix
// app.all(
//   "*",
//   createRequestHandler({
//     build,
//     mode: process.env.NODE_ENV,
//   })
// );

app.all("*", (req, res) => {
  res.send("Server is working");
});




const PORT = 3000;

// https.createServer(app).listen(PORT, () => {
//   console.log(`✅ HTTPS server running on port ${PORT}`);
// });


http.createServer(app).listen(PORT, () => {
  console.log(`✅ HTTPS server running on port ${PORT}`);
});
