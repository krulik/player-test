(function ($window) {

	$window.Animate = Animate;

	/**
	 * Generic animation module based on requestAnimationFrame.
	 * @param {Object} options Animation options such as:
	 *
	 * @param {Number} numFrames Number of frames to animate
	 * @param {Number} fps Number of frames to draw per second
	 * @param {Function} drawFrame A callback which is called every frame
	 * @param {Function} end A callback which is called at the end
	 */
	function Animate (options) {

		var raf = $window.requestAnimationFrame;

		var startTime;
		var currentFrame = 0;
		var numFrames = options.numFrames;
		var fps = options.fps;

		// This is the interval in which our animation frames
		// will be drawn regardless of the browsers FPS
		// i.e browsers FPS can be 60 (16ms) but if ours is 30
		// we'll draw every second frame
		var drawInterval = 1000 / fps;

		// Start animation loop
		raf(step);

		function step (currentTime) {
			if (!startTime) {
				startTime = currentTime;
			}

			// Elapsed time since we started animating
			var progress = currentTime - startTime;

			// Remove the redundant milliseconds caused by browsers' FPS
			var normalizedProgress = progress - (progress % drawInterval);

			// The frame number we need to draw based on elapsed time
			var nextFrame = normalizedProgress / drawInterval;

			// Draw next frame?
			if (currentFrame < nextFrame + 1) {
				options.drawFrame(currentFrame);
				currentFrame++;
			}

			// Stop animation?
			if (currentFrame < numFrames) {
				raf(step);
			} else {
				options.end(currentFrame);
			}
		}
	}

}(window));

/**
 * Player module
 * @param  {Window} $window   Window object
 * @param  {HTMLDocument} $document Document
 * @param  {Function} log       console.log
 * @param  {Function} Animate   Animate module
 * @return {Function}           Exposes Player function
 */
(function ($window, $document, log, Animate) {

	$window.Player = Player;

	/**
	 * Player constructor
	 * @param {HTMLElement} element The container in the markup to hold the player
	 * @param {Object} config  Sprite manifest from the server URL
	 */
	function Player (element, config) {

		create(element, config);
	}


	/**
	 * Following methods are not bound to the Player instance,
	 * thus needing some parameters passing (i.e element, config)
	 *
	 * TODO use some nice pattern to have private instance methods
	 * without exposing with .prototype and without re-defining with .this
	 */


	/**
	 * Creates a Player for given params.
	 */
	function create (element, config) {
		log(config);

		// "Fix" the data
		var sprites = config.images
			.map(addHttp)
			.sort(compareSpritesNum);

		// Do "all the things"
		handleSprites(sprites, element, config);
	}

	/**
	 * Performs all the work to setup and animate the sprites.
	 * @param  {Array} sprites A sorted array of sprite URLs
	 */
	function handleSprites (sprites, element, config) {

		// Wait for all the sprite images to load sequentially
		// TODO optimize UX by showing early and buffering of some kind
		Promise
			.all(sprites.map(waitToLoad))

			// Build a mega-sprite of sequential sprites
			.then(function (sprites) {
				return buildStrip(sprites, element, config);
			})

			// Animate it
			.then(function (strip) {
				return animateStrip(strip, element, config);
			})

			// -=The End=-
			.then(function (currentFrame) {
				log("end animation on %d frame", currentFrame);
			});
	}


	function buildStrip (sprites, element, config) {

		// Not async, Promise is just sugar to chain nicely later


		return new Promise(function (resolve, reject) {

			// Wrap the URLs with <img>s
			sprites = sprites.map(function (sprite) {
				return wrapWithImg(sprite, config);
			});

			// Build a long strip of those
			var strip = wrapWithStrip(sprites);

			// Hide overflow with a frame
			var frame = wrapWithFrame(strip, config.frameWidth, config.frameHeight);

			// Wrap with a link to see the provided movie
			var link = wrapWithLink(frame, config.videoUrl);

			// Tie it all together to the real DOM container which had started all the fun
			wrapWith(element, link);

			// We promised a strip, so...
			resolve(strip);
		});
	}

	/**
	 * Animate the mega-sprite by pulling up the built strip
	 * frame by frame (inside an overflow hidden frame),
	 * at the provided (or calculated?!) frame rate.
	 *
	 * @param  {HTMLElement} strip   The strip to animate
	 * @return {Promise}         When animation ends
	 */
	function animateStrip (strip, element, config) {

		return new Promise(function (resolve, reject) {

			// Question: which one to use?!
			var providedFps = config.framerate;
			var normalFps = config.numFrames / config.duration;

			var offset = 0;

			Animate({
				numFrames: config.numFrames - 1,
				fps: normalFps,
				drawFrame: function (currentFrame) {
					log("frame %d", currentFrame);
					offset += config.frameHeight;
					strip.style.transform = "translateY(-" + offset + "px)";
				},
				end: function (currentFrame) {
					resolve(currentFrame);
				}
			})
		});
	}

	/**
	 * Following are some utility functions.
	 *
	 * TODO add documentation.
	 */


	function wrapWithImg (sprite, config) {

		var framesInSprite = config.numFrames / config.images.length;
		var img = $document.createElement("img");
		img.style.width = config.frameWidth + "px";
		img.style.height = config.frameHeight * framesInSprite + "px";
		img.style.display = "block";
		img.src = sprite;
		return img;
	}

	function wrapWithStrip (elements) {
		var strip = $document.createElement("div");
		strip.className = "strip";
		elements.forEach(function (element) {
			strip.appendChild(element);
		});
		return strip;
	}

	function wrapWithFrame (element, width, height) {

		var frame = $document.createElement("div");
		frame.className = "frame";
		frame.style.width = width + "px";
		frame.style.height = height + "px";
		frame.style.overflow = "hidden";
		frame.appendChild(element);
		return frame;
	}

	function wrapWithLink (element, url) {

		var link = $document.createElement("a");
		link.href = url;
		link.title = url;
		link.target = "_blank";
		link.appendChild(element);
		return link;
	}

	function wrapWith (parent, child) {
		parent.appendChild(child);
		return parent;
	}

	function waitToLoad (sprite) {
		return new Promise(function (resolve, reject) {
			log("loading url=%s", sprite);
			var img = new $window.Image();
			img.onload = function () {
				log("loaded url=%s", sprite);
				resolve(sprite);
			};
			img.src = sprite;
		});
	}

	function compareSpritesNum (sprite1, sprite2) {
		sprite1 = getSpriteNum(sprite1);
		sprite2 = getSpriteNum(sprite2);
		if (sprite1 < sprite2) {
			return -1;
		}
		if (sprite1 > sprite2) {
			return 1;
		}
		if (sprite1 === sprite2) {
			return 0;
		}
	}

	function getSpriteNum (sprite) {
		var prefix = "sprite-";
		var suffix = ".jpg";

		var start = sprite.indexOf("sprite-");
		var end = sprite.indexOf(".jpg");

		return parseInt(sprite.substring(start + prefix.length, end));
	}

	function addHttp (url) {
		return "http://" + url;
	}

}(window,
  window.document,
  window.console.log.bind(console),
  window.Animate));

/**
 * The initialization module.
 * Uses the provided HTML and creates Player instances.
 *
 * @param  {Window} $window   Window object
 * @param  {HTMLDocument} $document Document
 * @param  {Function} log       console.log
 * @param  {Function} Player    Player constructor
 */
(function ($window, $document, log, Player) {

	var instances = $document.querySelectorAll("[data-player-url]");

	[].forEach.call(instances, createPlayer);

	function createPlayer (instance) {

		fetch(instance.dataset.playerUrl)
			.then(function (response) {
				log(response);
				response
					.json()
					.then(function (response) {
						new Player(instance, response);
					});
			});
	}

}(window,
  window.document,
  window.console.log.bind(console),
  window.Player))
