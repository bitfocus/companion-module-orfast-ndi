// Orfast NDI

var instance_skel = require('../../instance_skel');
var debug;
var log;

var crypto = require('crypto');

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions();

	return self;
};

instance.prototype.video_outputs = [];
instance.prototype.ndi_sources = [];


/**
 * Config updated by the user.
 */
instance.prototype.updateConfig = function(config) {
	var self = this;
	self.config = config;
};

/**
 * Initializes the module.
 */
instance.prototype.init = function() {
	var self = this;

	self.status(self.STATE_OK);
	self.get_video_outputs();
	self.get_ndi_sources();
};

instance.prototype.get_video_outputs = function() {
	var self = this;

	let cmd = `/v1/vo`;
	self.getRest(cmd, {}).then(function(result) {
		// Success
		self.video_outputs = [];
		for (let i = 0; i < result.data['vo_channels'].length; i++) {
			let name = result.data['vo_channels'][i]['name'];

			let videoOutputObj = { id: name, label: name };
			self.video_outputs.push(videoOutputObj);
		}
		self.actions(); //republish list of actions because of new video outputs
	}).catch(function(message) {
		self.log('error', self.config.host + ' : ' + message);
		self.status(self.STATE_ERROR);
	});
};

instance.prototype.get_ndi_sources = function() {
	var self = this;

	let cmd = `/v1/ndi`;
	self.getRest(cmd, {}).then(function(result) {
		// Success
		self.ndi_sources = [];
		for (let i = 0; i < result.data['ndi_source_list'].length; i++) {
			let ndiName = result.data['ndi_source_list'][i]['name'];

			let ndiSourceObj = { id: ndiName, label: ndiName };
			self.ndi_sources.push(ndiSourceObj);
		}
		self.actions(); //republish list of actions because of new NDI sources
	}).catch(function(message) {
		self.log('error', self.config.host + ' : ' + message);
		self.status(self.STATE_ERROR);
	});
};

instance.prototype.setChannel = function(vo, ndi, audio) {
	var self = this;

	let cmd = `/v1/${vo}`;
	let body = {};

	if (ndi) {
		body.ndiSource = ndi;
	}

	if (audio) {
		body.mute_audio = audio;
	}
	
	self.postRest(cmd, body).then(function(result) {
		// Success
	}).catch(function(message) {
		self.log('error', self.config.host + ' : ' + message);
		self.status(self.STATE_ERROR);
	});
};

/**
 * Return config fields for web config.
 */
instance.prototype.config_fields = function() {
	var self = this;

	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module will control OrFast NDI.'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'IP Address',
			width: 4,
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Port',
			default: 4242,
			width: 4,
			regex: self.REGEX_PORT
		}
	];

};


/**
 * Cleanup when the module gets deleted.
 */
instance.prototype.destroy = function() {
	var self = this;
	debug("destroy");
};


/**
 * Populates the supported actions.
 */
instance.prototype.actions = function(system) {
	var self = this;

	self.setActions({
		'set_channel': {
			label: 'Set NDI Channel',
			options: [
				{
					type: 'dropdown',
					label: 'Video Output',
					id: 'vo',
					choices: self.video_outputs
				},
				{
					type: 'dropdown',
					label: 'NDI Source',
					id: 'ndi',
					choices: self.ndi_sources
				}
			]
		},
		'set_channel_and_audio': {
			label: 'Set NDI Channel and Audio Mute',
			options: [
				{
					type: 'dropdown',
					label: 'Video Output',
					id: 'vo',
					choices: self.video_outputs
				},
				{
					type: 'dropdown',
					label: 'NDI Source',
					id: 'ndi',
					choices: self.ndi_sources
				},
				{
					type: 'dropdown',
					label: 'Audio Mute',
					id: 'audio',
					choices: [ { id: 'mute', label: 'Mute'}, { id: 'unmute', label: 'Unute'} ]
				}
			]
		},
		'set_audio': {
			label: 'Set Audio Mute',
			options: [
				{
					type: 'dropdown',
					label: 'Video Output',
					id: 'vo',
					choices: self.video_outputs
				},
				{
					type: 'dropdown',
					label: 'Audio Mute',
					id: 'audio',
					choices: [ { id: 'mute', label: 'Mute'}, { id: 'unmute', label: 'Unute'} ]
				}
			]
		},
		'get_ndi_sources': {
			label: 'Get Updated NDI Sources'
		}

	});
};


/**
 * Retrieves information via GET and returns a Promise.
 *
 * @param cmd           The command to execute
 * @return              A Promise that's resolved after the GET.
 */
instance.prototype.getRest = function(cmd, body) {
	var self = this;
	return self.doRest('GET', cmd, body);
};

/**
 * Requests/Retrieves information via POST and returns a Promise.
 *
 * @param cmd           The command to execute
 * @param body          The body of the POST; an object.
 * @return              A Promise that's resolved after the POST.
 */
instance.prototype.postRest = function(cmd, body) {
	var self = this;
	return self.doRest('POST', cmd, body);
};

/**
 * Performs the REST command, either GET or POST.
 *
 * @param method        Either GET or POST
 * @param cmd           The command to execute
 * @param body          If POST, an object containing the POST's body
 */
instance.prototype.doRest = function(method, cmd, body) {
	var self = this;
	var url  = self.makeUrl(cmd);

	return new Promise(function(resolve, reject) {

		function handleResponse(err, result) {
			if (err === null && typeof result === 'object' && result.response.statusCode === 200) {
				// A successful response
				resolve(result);
			} else {
				// Failure. Reject the promise.
				var message = 'Unknown error';

				if (result !== undefined) {
					if (result.response !== undefined) {
						message = result.response.statusCode + ': ' + result.response.statusMessage;
					} else if (result.error !== undefined) {
						// Get the error message from the object if present.
						message = result.error.code +': ' + result.error.message;
					}
				}

				reject(message);
			}
		}

		let headers = {};

		let extra_args = {};

		switch(method) {
			case 'POST':
				self.system.emit('rest', url, body, function(err, result) {
						handleResponse(err, result);
					}, headers, extra_args
				);
				break;

			case 'GET':
				self.system.emit('rest_get', url, function(err, result) {
						handleResponse(err, result);
					}, headers, extra_args
				);
				break;

			default:
				throw new Error('Invalid method');

		}

	});

};


/**
 * Runs the specified action.
 *
 * @param action
 */
instance.prototype.action = function(action) {
	var self = this;
	var opt = action.options;

	let audio;

	try {
		switch (action.action) {
			case 'set_channel':
				self.setChannel(opt.vo, opt.ndi, null);
				break;
			case 'set_channel_and_audio':
				audio = (opt.audio === 'mute' ? true : false);
				self.setChannel(opt.vo, opt.ndi, audio);
				break;
			case 'set_audio':
				audio = (opt.audio === 'mute' ? true : false);
				self.setChannel(opt.vo, null, audio);
				break;
			case 'get_ndi_sources':
				self.get_ndi_sources();
				break;
		}

	} catch (err) {
		self.log('error', err.message);
	}
};

/**
 * Runs the [POST] command.
 *
 * @param cmd           The command the run. Must start with '/'
 * @param body          The body of the POST content
 */
instance.prototype.doCommand = function(cmd, body) {
	var self = this;
	body = body || {};

	self.postRest(cmd, body).then(function(objJson) {
		// Success
	}).catch(function(message) {
		self.log('error', self.config.host + ' : ' + message);
	});
};

/**
 * Makes the complete URL.
 *
 * @param cmd           Must start with a /
 */
instance.prototype.makeUrl = function(cmd) {
	var self = this;

	if (cmd[0] !== '/') {
		throw new Error('cmd must start with a /');
	}

	return 'http://' + self.config.host + ':' + self.config.port + cmd;
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;