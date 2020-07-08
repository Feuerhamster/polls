// import modules
const fs = require("fs");

// create static class
class Config{

	static configPath = "./config.json";
	static config = {
		mongodb: {
			host: "localhost",
			username: "polls",
			password: "",
			database: "polls"
		},
		web: {
			port: 2000
		}
	};

	static initConfig(){

		// create config with default schema if not exists
		if(!fs.existsSync(Config.configPath) || fs.readFileSync(Config.configPath).toString() === ""){

			fs.writeFileSync(Config.configPath, JSON.stringify(Config.config, null, 4));

			console.warn("--- [ Config ] ---\n" +
				"No config file found. A new one has been created. Please fill in data and restart the application!");

			process.exit();

		}

		// get the config
		let config = fs.readFileSync(Config.configPath).toString();
		Config.config = JSON.parse(config);

		console.log("[Config] Loaded");

	}

	static getMongoUrl(){
		return `mongodb://${Config.config.mongodb.username}:${Config.config.mongodb.password}@${Config.config.mongodb.host}/?authSource=${Config.config.mongodb.database}`;
	}
}

// export static class
module.exports = Config;