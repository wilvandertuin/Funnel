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

$.funnel = function(element, options) {
	/**
	 * Default plugin options 
	 */
	var defaults = {
		/**
		 * Services to load the timeline of.
		 */
		services: null,
		
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
	// element.data('pluginName').options.propertyName from outside the plugin, where "element" is the
	// element the plugin is attached to;
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

		// Request each timeline
		for (var i = 0; i < plugin.options.services.length; i++) {
			services[plugin.options.services[i].name](
				plugin.options.services[i].user,
				plugin.options.services[i].tpl
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
	 * Container of services functions
	 */
	var services = {};

	/**
	 * Twitter service
	 */
	services.twitter = function(user, tpl) {
		var max_items = Math.ceil(
			plugin.options.max_items / plugin.options.services.length
		);

		var url = 'http://twitter.com/status/user_timeline/' + user
			+ '.json?count=' + max_items + '&callback=?';

		$.getJSON(url, function(data) {
			$.each(data, function(i, item) {
				var tweet = {
					"date": item.created_at,
					"relative_date": new Date(item.created_at).relative(),
					"msg": item.text.tweetify(),
					"user": user,
					"id": item.id_str
				};

				plugin.items.push({
					"item": tweet,
					"html": $('#' + tpl).tmpl(tweet)
				});		
			});

			// Display all items.
			sort();
			display();
		});
	};

	/**
	 * Delicious 
	 *
	 * Based on http://itp.nyu.edu/~cs220/dwd/class10-delicious.html
	 */
	services.delicious = function(user, tpl) {
		var max_items = Math.ceil(
			plugin.options.max_items / plugin.options.services.length
		);

		// Define the URL to be called
		var url = 'http://feeds.delicious.com/v2/json/' + user +
			'?plain&callback=?&count=' + max_items;
		
		// Get the data from the web service and process
		$.getJSON(url, function(data) {
			$.each(data, function(i, item) {
				var bookmark = {
					"date": item.dt,
					"relative_date": new Date(item.dt).relative(),
					"url": item.u,
					"title": item.d,
					"tags": item.t,
					"msg": item.n,
					"user": user
				};

				plugin.items.push({
					"item": bookmark,
					"html": $('#' + tpl).tmpl(bookmark)
				});
			});

			// Display all items.
			sort();
			display();
		});
	};

	services.tumblr = function(user, tpl) {
		var max_items = Math.ceil(
			plugin.options.max_items / plugin.options.services.length
		);

		// Define the URL to be called
		var url = 'http://' + user + '.tumblr.com/api/read/json';

		var process_photo = function(item) {
			var photo = {
				"date": item['date'],
				"relative_date": new Date(item['date']).relative(),
				"src": item['photo-url-250'],
				"caption": item['photo-caption'],
				"url": item['photo-link-url'],
				"user": user
			};

			plugin.items.push({
				"item": photo,
				"html": $('#' + tpl.photo).tmpl(photo)
			});
		};

		var process_video = function(item) {
			var video = {
				"date": item['date'],
				"relative_date": new Date(item['date']).relative(),
				"video_player": item['video-player-250'],
				"caption": item['video-caption'],
				"user": user
			};

			plugin.items.push({
				"item": video,
				"html": $('#' + tpl.video).tmpl(video)
			});
		};

		// Get the data from the web service and process
		$.ajax({
			"url": url,
			"dataType": 'jsonp',
			"success": function (data, textStatus, jqXHR) {
				var posts = data.posts;

				$.each(posts, function(i, item) {
					// There can be different types of posts.
					// photo, video, quote

					if (item.type == 'photo') {
						process_photo(item);
						return;
					}

					if (item.type == 'video') {
						process_video(item); 
					}
				});

				// Display all items.
				sort();
				display();
			}
		});
	};
	
	services.youtube = function(user, tpl) {};
	services.github = function(user, tpl) {};

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
