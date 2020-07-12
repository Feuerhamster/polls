// require node modules
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const cleanup = require("node-cleanup");
const cors = require("cors");
const fingerprint = require("express-fingerprint");
const crypto = require("crypto");

// require services
const Config = require("./services/config");
const Database = require("./services/database");

// init modules and services
const app = express();
Config.initConfig();
Database.connect();

// express middlewares
app.use(bodyParser.json());
app.use(cors());
app.use(fingerprint({ parameters: [ fingerprint.useragent, fingerprint.geoip ]  }));

// Usage as standalone api
app.use("/api/*", (req, res, next) => {

	req.standaloneAPI = !!req.headers["standalone-api"];

	if(req.headers["custom-id"]){
		req.customId = crypto.createHash("sha256").update(req.headers["custom-id"]).digest("hex");
	}else{
		req.customId = null;
	}

	next();

})

// load routes
app.use("/api/polls", require("./routes/polls.js"));
app.use(express.static("public"));

// start server
const server = app.listen(Config.config.web.port, () => {
	console.log(`[express] Server running on ${Config.config.web.port}`)
});

// do cleanup on exit
cleanup((exitCode, signal) => {

	console.log("[mongodb] close client...");
	Database.client.close();
	console.log("[express] close server...");
	server.close();

	console.log("Application shutdown successful!");

});