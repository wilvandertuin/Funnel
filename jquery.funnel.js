/**
 * jQuery Funnel
 *
 * Funnels online activity from different websites into a webpage
 * ordered by time according to user specified templates.
 *
 * Copyright (c) 2011 Jeroen van der Tuin <jeroen@vandertuin.nl>
 * Licensed under the MIT license.
 */

(function($) {

var Funnel = function(element, options) {
	/**
	 * Reference to the jQuery version of the DOM element.
	 */
	var $element = $(element);
	
	/**
	 * Reference to the current instance of the object.
	 */
	var plugin = this;
	
	// plugin's properties will be available through this object like:
	// plugin.settings.propertyName from inside the plugin or
	// element.data('pluginName').settings.propertyName from outside.
	plugin.settings = {
		/**
		 * Services to load the timeline of.
		 */
		services: new Array(),
		
		/**
		 * Max number of items to show in total.
		 */
		max_items: 25,

		/**
		 * A callback after every refresh.
		 */
		callback: null
	};

	var services_required, services_completed = 0;

	/**
	 * Constructor
	 *
	 * Loads the data of each service. The handler of each service then
	 * merges its items into the timeline and displays it asynchronously.
	 */
	plugin.init = function() {
		$.extend(plugin.settings, options);

		// Remember how many services are required.
		services_required = plugin.settings.services.length;

		// Request each timeline.
		for (var i = 0; i < services_required; i++) {
			var service = plugin.settings.services[i];
			services[service.name](service);
		}
	}

	/**
	 * This array contains the items selected by the different services,
	 * they are publicly available from the element.
	 */
	plugin.items = new Array();

	/**
	 * Container of services functions.
	 */
	var services = {};

	/**
	 * Twitter
	 */
	services.twitter = function(options) {
		var url = 'http://twitter.com/status/user_timeline/' + options.user
			+ '.json?count=' + options.max_items + '&callback=?';

		$.getJSON(url, function(data) {
			$.each(data, function(i, item) {
				item.date = item.created_at;
				item.relative_date = new Date(item.created_at).relative();

				plugin.items.push({
					"item": item,
					"html": $(options.tmpl).tmpl(item, {"feed": data})
				});	
			});
			sort(), display();
		});
	};

	/**
	 * Delicious 
	 *
	 * Based on http://itp.nyu.edu/~cs220/dwd/class10-delicious.html
	 */
	services.delicious = function(options) {
		var url = 'http://feeds.delicious.com/v2/json/' + options.user +
			'?plain&callback=?&count=' + options.max_items;
		
		$.getJSON(url, function(data) {
			$.each(data, function(i, item) {
				item.date = item.dt;
				item.relative_date =  new Date(item.dt).relative();

				// TODO: Can the user be found inside the returned data?
				item.user = options.user;

				plugin.items.push({
					"item": item,
					"html": $(options.tmpl).tmpl(item, {"feed": data})
				});
			});
			sort(), display();
		});
	};

	services.tumblr = function(options) {
		var url = 'http://' + options.user + '.tumblr.com/api/read/json';

		$.ajax({
			"url": url,
			"dataType": 'jsonp',
			"success": function (data, textStatus, jqXHR) {
				$.each(data.posts, function(i, item) {
					item.relative_date = new Date(item['date']).relative();

					// Skip if there is no template for this post type.
					if (options.tmpl.hasOwnProperty(item.type) === false) return;

					// Replace dashes with underscores in keys so to they can be
					// read by the template engine but retaining the original keys.
					for (key in item) {
						item[key.replace(/-/g, '_')] = item[key];
					}

					plugin.items.push({
						"item": item,
						"html": $(options.tmpl[item.type]).tmpl(item, {"feed": data})
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
	 * Appends each item to the target element and calls the callback.
	 */
	var display = function() {
		$element.html('');

		// Place the HTML for all items in the timeline, minding the limit.
		for (var i = 0; i < plugin.items.length; i++) {
			if (i == plugin.settings.max_items) break;
			plugin.items[i].html.appendTo($element);
		}

		services_completed += 1;

		if (services_completed < services_required) {
			return;
		}

		// Execute a global callback.
		if (plugin.settings.callback != null) {
			plugin.settings.callback();
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
			var plugin = new Funnel(this, options);

			// in the jQuery version of the element
			// store a reference to the plugin object
			// you can later access the plugin and its methods and properties like
			// element.data('pluginName').publicMethod(arg1, arg2, ... argn) or
			// element.data('pluginName').options.propertyName
			$(this).data('funnel', plugin);
		}
	});
}

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

})(jQuery);
