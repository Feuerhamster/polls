// import node modules
const MongoDB = require("mongodb");
const UUID = require("uuid");
const crypto = require("crypto");
const shortHash = require("short-hash");

// import services
const Config = require("./config");

class Database{
	
	static connect(){

		Database.client = new MongoDB.MongoClient(Config.getMongoUrl(), { tls: false, useUnifiedTopology: true });

		Database.client.connect((err) => {

			if (err) {
				console.error(err);
				return;
			}

			Database.db = this.client.db(Config.config.mongodb.database);
			console.log("[mongodb] Successful connected");

		});

	}

	/*
	* Poll functions
	* */

	static createPoll(title, description, author, options, isPublic, isMultiple){

		let id = shortHash(UUID.v4());
		let token = crypto.createHash("sha256").update(UUID.v4()).digest("hex");

		let poll = {
			id,
			title,
			author,
			creationDate: new Date(),
			options,
			description,
			isPublic,
			isMultiple,
			token,
			votes: {},
			visitors: []
		};

		return new Promise((resolve, reject) => {

			Database.db
				.collection("polls")
				.insertOne(poll)
				.then(res => {
					resolve(res);
				})
				.catch(err => {
					reject(err);
				})

		});

	}

	static getPoll(query){

		return new Promise((resolve, reject) => {

			Database.db
				.collection("polls")
				.findOne(query, (err, res) => {

					if(err){
						reject(err);
					}else{

						if(res && res._id){
							delete res._id;
						}

						resolve(res);
					}

				});

		});

	}

	static getFilteredPolls(filter){

		return new Promise((resolve, reject) => {

			Database.db
				.collection("polls")
				.find({ isPublic: true }).sort(filter).limit(5)
				.toArray((err, res) => {

					if(err){
						reject(err);
					}else{

						if(res){
							for(let i = 0; i < res.length; i++){
								res[i] = Database.formatPollObject(res[i]);
							}
						}

						resolve(res);
					}

				});

		});

	}

	static vote(query, fingerprint, choices){

		return new Promise((resolve, reject) => {

			let updater = { $set: {} };
			updater.$set[`votes.${fingerprint}`] = choices;

			Database.db
				.collection("polls")
				.updateOne(query, updater, (err, res) => {

					if(err){
						reject(err);
					}else{
						resolve(res);
					}

				});

		});

	}

	static removeVote(id, fingerprint){

		return new Promise((resolve, reject) => {

			let updater = { $unset: {} };

			updater.$unset[`votes.${fingerprint}`] = "";

			Database.db
				.collection("polls")
				.updateOne({ id }, updater, (err, res) => {

					if(err){
						reject(err);
					}else{
						resolve(res);
					}

				});

		});

	}

	static visitPoll(id, fingerprint){

		return new Promise((resolve, reject) => {

			Database.db
				.collection("polls")
				.updateOne({ id }, { $push: { visitors: fingerprint } }, (err, res) => {

					if(err){
						reject(err);
					}else{
						resolve(res);
					}

				});

		});

	}

	static deletePoll(query){

		return new Promise((resolve, reject) => {

			Database.db
				.collection("polls")
				.deleteOne(query, function (err, obj) {

					if(err){
						reject(err);
					}else{
						resolve(true);
					}

				})

		});

	}


	/*
	* Util functions
	* */

	static checkForValidChoices(poll, choices){


		if(choices.length > 1 && !poll.isMultiple){
			return false;
		}

		for(let c of choices){

			if(!poll.options[c]){
				return false;
			}

		}

		return true;

	}

	static calculateResults(votes, baseLength){

		let result = new Array(baseLength).fill(0);

		for(let vote of Object.values(votes)){

			for(let choice of vote){

				if(result[choice]){
					result[choice]++;
				}else{
					result[choice] = 1;
				}

			}

		}

		return result;

	}

	static formatPollObject(poll){

		delete poll._id
		delete poll.token;

		poll.views = poll.visitors.length;
		delete poll.visitors;

		poll.totalVotes = Object.keys(poll.votes).length;

		poll.votes = Database.calculateResults(poll.votes, poll.options.length);

		//poll.results = Object.assign(...poll.options.map((k, i) => ({[k]: poll.votes[i]})));


		return poll;

	}

}


module.exports = Database;