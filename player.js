(function ($window) {

	$window.Animate = Animate;

	function Animate (options) {

		var raf = $window.requestAnimationFrame;

		var startTime;
		var currentFrame = 0;
		var numFrames = options.numFrames;
		var fps = options.fps;
		var drawInterval = 1000 / fps;

		raf(step);

		function step (currentTime) {
			if (!startTime) {
				startTime = currentTime;
			}

			var progress = currentTime - startTime;
			var normalizedProgress = progress - (progress % drawInterval);
			var nextFrame = normalizedProgress / drawInterval;

			// Frame condition
			if (currentFrame < nextFrame + 1) {
				options.drawFrame(currentFrame);
				currentFrame++;
			}

			// Stop condition
			if (currentFrame < numFrames) {
				raf(step);
			} else {
				options.end(currentFrame);
			}
		}
	}

}(window));

(function ($window, $document, log, Animate) {

	$window.Player = Player;

	function Player (element, config) {

		create(element, config);
	}

	function create (element, config) {
		log(config);

		var sprites = config.images
			.map(addHttp)
			.sort(compareSpritesNum);

		handleSprites(sprites, element, config);
	}

	function handleSprites (sprites, element, config) {

		Promise
			.all(sprites.map(waitToLoad))
			.then(function (sprites) {
				return buildStrip(sprites, element, config);
			})
			.then(function (strip) {
				return animateStrip(strip, element, config);
			})
			.then(function (currentFrame) {
				log("end animation on %d frame", currentFrame);
			});
	}

	function buildStrip (sprites, element, config) {

		return new Promise(function (resolve, reject) {

			sprites = sprites.map(function (sprite) {
				return wrapWithImg(sprite, config);
			});

			var strip = wrapWithStrip(sprites);
			var frame = wrapWithFrame(strip, config.frameWidth, config.frameHeight);
			var link = wrapWithLink(frame, config.videoUrl);
			wrapWith(element, link);

			resolve(strip);
		});
	}

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
					strip.style.webkitTransform = "translateY(-" + offset + "px)";
				},
				end: function (currentFrame) {
					resolve(currentFrame);
				}
			})
		});
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


(function ($window, $document, log, Player) {

	var instances = $document.querySelectorAll("[data-player-url]");

	[].forEach.call(instances, createPlayer);


	var players = [];

	function createPlayer (instance) {

		fetch(instance.dataset.playerUrl)
			.then(function (response) {
				log(response);
				response
					.json()
					.then(function (response) {
						players.push(new Player(instance, response));
					});
			});
	}

}(window,
  window.document,
  window.console.log.bind(console),
  window.Player))
