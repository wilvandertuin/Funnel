/**
 * jQuery Funnel
 *
 * Funnels online activity from different websites into a webpage
 * ordered by time according to user specified templates.
 *
 * Copyright (c) 2011 Jeroen van der Tuin <jeroen@vandertuin.nl>
 * Licensed under the MIT license.
 */

/**
 * Overload the String object with Tweetify which creates links
 * from URLs, @usernames and #hashtags.
 *
 * http://css-tricks.com/snippets/jquery/jquery-tweetify-text/
 */
String.prototype.tweetify = function() {
	return this
		.replace(/((ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?)/gi,'<a href="$1">$1</a>')
		.replace(/(^|\s)#(\w+)/g,'$1<a href="http://search.twitter.com/search?q=%23$2">#$2</a>')
		.replace(/(^|\s|.)@(\w+)/g,'$1<a href="http://twitter.com/$2">@$2</a>');
};

/**
 * Overload the Date object with a relative time method.
 * https://github.com/jherdman/javascript-relative-time-helpers
 */
Date.prototype.relative = function(now_threshold) {
	var delta = new Date() - this;

	now_threshold = parseInt(now_threshold, 10);

	if (isNaN(now_threshold)) {
		now_threshold = 0;
	}

	if (delta <= now_threshold) {
		return 'Just now';
	}

	var units = null;
	var conversions = {
		millisecond: 1,
		second: 1000,
		minute: 60,
		hour: 60,
		day: 24,
		month: 30,
		year: 12
	};

	for (var key in conversions) {
		if (delta < conversions[key]) break;
		units = key; // keeps track of the selected key over the iteration
		delta = delta / conversions[key];
	}

	// Pluralize a unit when the difference is greater than 1.
	delta = Math.floor(delta);
	if (delta !== 1) { units += "s"; }
	return [delta, units, "ago"].join(" ");
};

/*
 * Wraps up a common pattern used with this plugin whereby you take a String
 * representation of a Date, and want back a date object.
 */
Date.fromString = function(str) {
	return new Date(Date.parse(str));
};

(function($) {

$.funnel = function(element, options) {
	/**
	 * Default plugin options 
	 */
	var defaults = {
		/**
		 * Services to load the timeline of.
		 */
		services: new Array(),
		
		/**
		 * Max number of items to show in total.
		 */
		max_items: 10
	}

	/**
	 * Reference to the current instance of the object.
	 */
	var plugin = this;

	// this will hold the merged default, and user-provided options
	// plugin's properties will be available through this object like:
	// plugin.options.propertyName from inside the plugin or
	// element.data('pluginName').options.propertyName from outside the
	// plugin, where "element" is the element the plugin is attached to;
	plugin.options = {}

	/**
	 * Reference to the jQuery version of the DOM element.
	 */
	var $element = $(element);

	/**
	 * Constructor
	 *
	 * Loads the data of each service. The handler of each service then
	 * merges its items into the timeline and displays it asynchronously.
	 */
	plugin.init = function() {
		plugin.options = $.extend({}, defaults, options);

		// Set maximum number of items per source.
		max_items_per_service = Math.ceil(
			plugin.options.max_items / plugin.options.services.length
		);

		// Request each timeline
		for (var i = 0; i < plugin.options.services.length; i++) {
			services[plugin.options.services[i].name](
				plugin.options.services[i].user,
				plugin.options.services[i].tmpl
			);
		}
	}

	/**
	 * Public vars and functions
	 *
	 * Can be reached inside the plugin as:
	 * plugin.methodName(arg1, arg2, ... argn)
	 * and from outside as:
	 * element.data('pluginName').publicMethod(arg1, arg2)
	 */

	/**
	 * This array contains the items selected by the different services.
	 */
	plugin.items = new Array();

	/**
	 * Private vars and functions
	 */

	/**
	 * This is calculated upon init.
	 */
	var max_items_per_service = null;


	/**
	 * Container of services functions
	 */
	var services = {};

	/**
	 * Twitter service
	 */
	services.twitter = function(user, tmpl) {
		var url = 'http://twitter.com/status/user_timeline/' + user
			+ '.json?count=' + max_items_per_service + '&callback=?';

		$.getJSON(url, function(data) {
			$.each(data, function(i, item) {
				item.date = item.created_at;
				item.relative_date = new Date(item.created_at).relative();

				plugin.items.push({
					"item": item,
					"html": $('#' + tmpl).tmpl(item, {"feed": data})
				});		
			});

			// Display all items.
			sort(), display();
		});
	};

	/**
	 * Delicious 
	 *
	 * Based on http://itp.nyu.edu/~cs220/dwd/class10-delicious.html
	 */
	services.delicious = function(user, tmpl) {
		// Define the URL to be called
		var url = 'http://feeds.delicious.com/v2/json/' + user +
			'?plain&callback=?&count=' + max_items_per_service;
		
		// Get the data from the web service and process
		$.getJSON(url, function(data) {
			$.each(data, function(i, item) {
				item.date = item.dt;
				item.relative_date =  new Date(item.dt).relative();

				// TODO: Can the user be found inside the returned data?
				item.user = user;

				plugin.items.push({
					"item": item,
					"html": $('#' + tmpl).tmpl(item, {"feed": data})
				});
			});

			// Display all items.
			sort(), display();
		});
	};

	services.tumblr = function(user, tmpl) {

		// Define the URL to be called
		var url = 'http://' + user + '.tumblr.com/api/read/json';

		// Get the data from the web service and process
		$.ajax({
			"url": url,
			"dataType": 'jsonp',
			"success": function (data, textStatus, jqXHR) {
				$.each(data.posts, function(i, item) {
					item.relative_date = new Date(item['date']).relative();

					// Skip if there is no template for this post type.
					if (tmpl.hasOwnProperty(item.type) === false) return;

					// Replace dashes with underscores in keys so to they can be
					// read by the template engine but retaining the original keys.
					for (key in item) {
						item[key.replace(/-/g, '_')] = item[key];
					}

					// Add generated HTML for feed item to list.
					plugin.items.push({
						"item": item,
						"html": $(tmpl[item.type]).tmpl(item, {"feed": data})
					});
				});

				sort(), display();
			}
		});
	};

	/**
	 * Sorts the items by date.
	 */
	var sort = function() {
		plugin.items.sort(function(a, b) {
			var a = Date.parse(a.item.date);
			var b = Date.parse(b.item.date);
			return b - a;
		});
	};

	/**
	 * Appends each item to the target element.
	 */
	var display = function() {
		$element.html('');

		for (var i = 0; i < plugin.items.length; i++) {
			if (i == plugin.options.max_items) break;
			plugin.items[i].html.appendTo($element);
		}
	};

	// Call the constructor
	plugin.init();
}

// add the plugin to the jQuery.fn object
$.fn.funnel = function(options) {
	// iterate through the DOM elements we are attaching the plugin to
	return this.each(function() {
		// if plugin has not already been attached to the element
		if (undefined == $(this).data('funnel')) {
			// create a new instance of the plugin
			// pass the DOM element and the user-provided options as arguments
			var plugin = new $.funnel(this, options);

			// in the jQuery version of the element
			// store a reference to the plugin object
			// you can later access the plugin and its methods and properties like
			// element.data('pluginName').publicMethod(arg1, arg2, ... argn) or
			// element.data('pluginName').options.propertyName
			$(this).data('funnel', plugin);
		}
	});
}

})(jQuery);
