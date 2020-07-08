// import node modules
const express = require("express");
const router = express.Router();
const val = require("express-validator").body;
const valQS = require("express-validator").query;
const validate = require("../services/validate");

// import services
const Database = require("../services/database");

/*
* Route to register a new user
* */
router.post("/", [

	val("title").exists().withMessage("not_found").notEmpty().withMessage("not_found").isString().withMessage("not_a_string").isLength({ min: 5, max: 40 }).withMessage("out_of_range"),
	val("description").exists().withMessage("not_found").notEmpty().withMessage("not_found").isString().withMessage("not_a_string").isLength({ min: 30, max: 600 }).withMessage("out_of_range"),
	val("author").exists().withMessage("not_found").notEmpty().withMessage("not_found").isString().withMessage("not_a_string").isLength({ min: 4, max: 40 }).withMessage("out_of_range"),
	val("isPublic").exists().withMessage("not_found").notEmpty().withMessage("not_found").isBoolean().withMessage("not_a_boolean"),
	val("isMultiple").exists().withMessage("not_found").notEmpty().withMessage("not_found").isBoolean().withMessage("not_a_boolean"),
	val("options").exists().withMessage("not_found").notEmpty().withMessage("not_found").isArray({ min: 2, max: 8 }).withMessage("not_an_array"),
	validate

], async (req, res) => {

	let result = await Database.createPoll(
		req.body.title,
		req.body.description,
		req.body.author,
		req.body.options,
		req.body.isPublic,
		req.body.isMultiple
	);

	let poll = result.ops[0];
	delete poll._id;
	delete poll.visitors;
	delete poll.results;
	poll.views = 0;

	res.send(poll);

});

router.get("/:id", async (req, res) => {

	// Get poll by id
	let poll = await Database.getPoll({ id: req.params.id });

	if(!poll){
		res.status(404).send({ error: 'not_found' });
		return;
	}

	// Update poll visitors if this is a new visitor
	if(
		(!req.standaloneAPI && !poll.visitors.includes(req.fingerprint.hash)) ||
		(req.standaloneAPI && req.customId && !poll.visitors.includes(req.customId))
	){
		await Database.visitPoll(req.params.id, req.standaloneAPI ? req.customId : req.fingerprint.hash);
	}



	// Check if user has voted
	if(
		(!req.standaloneAPI && poll.votes[ req.fingerprint.hash ]) ||
		(poll.votes[ req.customId ])
	){
		poll.voted = true;
	}else{
		poll.voted = false;
	}

	poll.views = poll.visitors.length;
	delete poll.visitors;
	delete poll.token;

	// calculate results
	poll.votes = Database.calculateResults(poll.votes);

	res.send(poll);

});

router.patch("/:id/votes", async (req, res) => {

	// Manual input validation
	if(!Array.isArray(req.body) || req.body.some(isNaN) || req.body.length < 1){
		res.status(422).send({ error: 'invalid_body' });
		return;
	}

	// Return if is standalone api use and no custom id is provided
	if(req.standaloneAPI && !req.customId){
		res.status(400).send({ error: 'missing_custom_id' });
		return;
	}

	// Get poll by id
	let poll = await Database.getPoll({ id: req.params.id });

	// 404 if poll does not exist
	if(!poll){
		res.status(404).send({ error: 'not_found' });
		return;
	}

	// Update poll visitors if this is a new visitor
	if(!poll.visitors.includes(req.standaloneAPI ? req.customId : req.fingerprint.hash)){
		await Database.visitPoll(req.params.id, req.standaloneAPI ? req.customId : req.fingerprint.hash);
	}

	// Check if user has already voted
	if(poll.votes[ req.standaloneAPI && req.customId ? req.customId : req.fingerprint.hash ]){
		res.status(403).send({ error: 'already_voted' });
		return;
	}

	// Check if the choice is right for the poll (check for multiple and indexes)
	if(!Database.checkForValidChoices(poll, req.body)){
		res.status(404).send({ error: 'invalid_choice' });
		return;
	}

	let result = await Database.vote(
		{ id: req.params.id },
		req.standaloneAPI && req.customId ? req.customId : req.fingerprint.hash,
		req.body
	);

	if(result.result.ok !== 1){
		res.status(500).end();
		return;
	}

	res.status(200).end();

});

router.delete("/:id/votes", async (req, res) => {

	// Return if is standalone api use and no custom id is provided
	if(req.standaloneAPI && !req.customId){
		res.status(400).send({ error: 'missing_custom_id' });
		return;
	}

	// Get poll by id
	let poll = await Database.getPoll({ id: req.params.id });

	// 404 if poll does not exist
	if(!poll){
		res.status(404).send({ error: 'not_found' });
		return;
	}

	// Check if user has already voted
	if(!poll.votes[ req.standaloneAPI && req.customId ? req.customId : req.fingerprint.hash ]){
		res.status(403).send({ error: 'not_voted' });
		return;
	}

	let result = await Database.removeVote(req.params.id, req.standaloneAPI && req.customId ? req.customId : req.fingerprint.hash);

	if(result.result.ok === 1){
		res.status(200).end();
	}else{
		res.status(500).send({ error: 'not_deleted' });
	}

});

router.delete("/:id", [
	valQS("token").exists().withMessage("not_found"),
	validate
], async (req, res) => {

	// Get poll by id
	let poll = await Database.getPoll({ id: req.params.id });

	// 404 if poll does not exist
	if(!poll){
		res.status(404).send({ error: 'not_found' });
		return;
	}

	// Check permission with token
	if(poll.token !== req.query.token){
		res.status(401).send({ error: 'access_denied' });
		return;
	}

	let result = await Database.deletePoll({ id: req.params.id });

	if(result){
		res.status(200).end();
	}else{
		res.status(500).send({ error: 'not_deleted' });
	}

});

module.exports = router;