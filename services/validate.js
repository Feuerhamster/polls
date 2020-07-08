const valRes = require("express-validator").validationResult;

function validate(req, res, next){
	const errors = valRes(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({ error: "validation_error", problems: errors.mapped() });
	}else{
		next();
	}
}

module.exports = validate;