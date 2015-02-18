var db = require('koa-mongo-db');
var Promise = require('bluebird');

var Model = module.exports = function(options) {
	options = options || {};
	if (typeof options == 'string') options = {name: options};

	this.name = options.name || 'misc';
	this.indexes = options.indexes || [];

	['create', 'update', 'get', 'list', 'delete'].forEach(function(method) {
		this[method] = this[method].bind(this);
	}, this);

	this.init();
};


Model.prototype.init = function() {
	var self = this;

	db(this.name).then(function(collectionObj) {
		// store the collection Object
		self.collection = collectionObj;

		// create any unique indexes
		self.indexes.forEach(function(index) {
			var options = {};
			var constraint = {};
			var indexNames = index.names || [index.name || index];

			indexNames.forEach(function(name) {
				options[name] = 1;
			});

			if (index.unique !== false) constraint = {unique: true, sparse: true};

			self.collection.ensureIndexAsync(options, constraint)
			.catch(onInitError.bind(self));
		});
	});


};


Model.prototype.create = function(data, opts) {
	return this.collection.insertAsync(data, opts).then(function(docs) {
		return docs && docs[0];
	});
};


Model.prototype.update = function(where, data, options) {
	var self = this;

	if (!data) {
		data = {$set: where};
		where = data.$set._id;
		delete data.$set._id;
	}

	if (data.$set) data.$set.modified = Date.now();

	return this.collection.updateAsync(idToWhere(where), data, options)
	.then(function(result) {
		if (result[0]) return self.get(where); // number affected

		var err = new Error('not found');
		err.status = 404;
		throw err;
	});
};


Model.prototype.get = function(where) {
	return this.collection.findOneAsync(idToWhere(where));
};


Model.prototype.list = function(where, options) {
	options = options || {};
	var fields = options.fields || {};

	var cursor = this.collection.find(where, fields)
	.sort(options.sort)
	.skip(options.skip)
	.limit(options.limit);

	return Promise.promisify(cursor.toArray, cursor)();
};


Model.prototype.delete = function(where) {
	return this.collection.removeAsync(idToWhere(where));
};


Model.prototype.ObjectID = db.ObjectID;


Model.prototype.idToObjID = idToObjID;


function onInitError(err) {
	console.log('ERROR: %s db init', this.name, err);
}


function idToWhere(id) {
	if (typeof id == 'string') id = db.ObjectID(id);
	if (id instanceof db.ObjectID) id = {_id: id};
	return id;
}


function idToObjID(id) {
	if (typeof id == 'string') return db.ObjectID(id);
	return id;
}
