// Generates a self-signed certificate for localhost (no OpenSSL needed).
const selfsigned = require("selfsigned");
const fs = require("fs");
const path = require("path");

const certsDir = path.join(__dirname, "certs");
fs.mkdirSync(certsDir, { recursive: true });

const pems = selfsigned.generate([{ name: "commonName", value: "localhost" }], {
  days: 365,
  keySize: 2048,
  algorithm: "sha256",
  extensions: [
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: "localhost" }, // DNS
        { type: 7, ip: "127.0.0.1" }, // IP
      ],
    },
  ],
});

fs.writeFileSync(path.join(certsDir, "key.pem"), pems.private);
fs.writeFileSync(path.join(certsDir, "cert.pem"), pems.cert);

console.log("Created certs/key.pem and certs/cert.pem (valid for 365 days)");
