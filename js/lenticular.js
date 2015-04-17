/*
 * Lenticular
 * http://lenticular.attasi.com
 *
 * Licensed under the MIT license.
 * Copyright 2012 Tom Giannattasio
 */

(function (window, document, undefined) {
	'use strict';

	var Lenticular = window.Lenticular = window.Lenticular || {};

	Lenticular.version = '0.3';
	Lenticular.images = [];
	Lenticular.axisTable = {
		landscape: {
			x: 'gamma',
			y: 'beta',
			z: 'alpha'
		},
		portrait: {
			x: 'beta',
			y: 'gamma',
			z: 'alpha'
		}
	};

	Lenticular.serOrientationHandler = function() {
		Lenticular.updateOrientation();
		window.addEventListener(
			'orientationchange',
			Lenticular.updateOrientation,
			false
		);
	};

	Lenticular.clamp = function(val, min, max) {
	    if (val > max) {
	    	return max;
	   	}
	    if (val < min) {
	    	return min;
	    }
	    return val;
	};

	Lenticular.updateFrames = function(e) {
		Lenticular.images.filter(function(image) {
			return image.isActive;
		}).forEach(function(image) {
			// pull proper angle based on orientation
			var axis = Lenticular.axisTable[Lenticular.orientation][image.axis];
			var angle = e[axis];

			// show the proper frame
			var percent = Lenticular.clamp(
				(angle - image.adjustedMin) / image.tiltRange, 0, 1
			);
			image.showFrame(Math.floor(percent * (image.frames - 1)));
		});
	};

	Lenticular.updateOrientation = function() {
		if (window.orientation === 0) {
			Lenticular.orientation = 'portrait';
		} else {
			Lenticular.orientation = 'landscape';
		}

		Lenticular.images = Lenticular.images.map(function(image) {
		    // reset min and max based on orientation
		    image.adjustedMin = image.minTilt;
		    if (image.axis !== 'x') {
		    	return image;
		    }
	        if (window.orientation === 90) {
	            image.adjustedMin -= 45;
	        } else {
	            image.adjustedMin += 45;
	        }
		    return image;
		});
	};

	Lenticular.Image = function(element, settings) {
		// settings
		var self = this;
		this.element = element;
		this.axis = settings.axis || 'y';
		this.images = settings.images || null;
		this.frames = settings.frames;
		this.minTilt = settings.min || -10;
		this.maxTilt = settings.max || 10;
		this.isActive = settings.isActive === false ? false : true;
		this.tiltRange = this.maxTilt - this.minTilt;
		this.useTilt = settings.useTilt === false ? false : true;
		this.bodyWidth = window.innerWidth;
		this.watchId = 0;

		// split the image path
		var splitImagePath = this.images.split('##');
		this.imagePrefix = splitImagePath[0];
		this.imageSuffix = splitImagePath[1];

		// add to global image stack
		Lenticular.images.push(this);

		// create image set
		this.imageSet = document.createElement('div');
		this.imageSet.setAttribute('class', 'lenticular-set');
		this.imageSet.style.cssText = 'position: relative; ' +
									  'width: 100%; ' +
									  'height: 100%; ' +
									  'overflow: hidden;';
		this.imageSet.frames = [];

		// add images to DOM
		var loaders = [];
		var loadTimer = setInterval(function() {
			var isFinished = true;
			for (var loader in loaders) {
				if (loaders[loader].isLoaded === false) {
					isFinished = false;
					break;
				}
			}
			if (loaders.length === self.frames && isFinished) {
				clearInterval(loadTimer);
				self.element.dispatchEvent(new Event('load'));
			}
		}, 100);

		var imageLoadingError = function() {
			this.isLoaded = true;
			self.frames-=1;
			loaders.splice(loaders.indexOf(this), 1);
		};
		var imageLoaded = function() {
			this.isLoaded = true;
		};

		for (var i = 1; i <= this.frames; i+=1) {
			var frame = document.createElement('img');
			frame.isLoaded = false;
			frame.index = i;
			loaders.push(frame);
			frame.addEventListener('error', imageLoadingError, false);
			frame.addEventListener('load', imageLoaded, false);
			frame.setAttribute('src', this.imagePrefix + i + this.imageSuffix);
			frame.style.cssText = 'position: absolute; ' +
								  'top: 0; ' +
								  'left: 0; ' +
								  'visibility: hidden;';
			this.imageSet.appendChild(frame);
			this.imageSet.frames.push(frame);
		}

		this.element.appendChild(this.imageSet);

		// activate
		if (Lenticular.images.length === 1 && this.useTilt) {
			['cordova',
			 'DeviceOrientationEvent',
			 'ontouchstart',
			 'onmousemove'].filter(function(eventName) {
			 	if ('DeviceOrientationEvent' === eventName &&
			 		!('ontouchstart' in window)) {
			 		return false;
			 	}
			 	return eventName in window;
			 }).some(function(eventName) {
				switch(eventName) {
				case 'cordova':
					document.addEventListener('deviceready', function() {
						Lenticular.serOrientationHandler();
						self.watchId = navigator.devicemotion.watchAttitude(
							Lenticular.updateFrames
						);
					}, false);
					return true;
				case 'DeviceOrientationEvent':
					Lenticular.serOrientationHandler();
					window.addEventListener(
						'deviceorientation',
						Lenticular.updateFrames,
						false
					);
					return true;
				case 'ontouchstart':
					self.showFrame(0);
					window.addEventListener('touchmove', function(e) {
						var horizontal = 1 - (e.pageX / self.bodyWidth || 0);
						self.showFrame(
							Math.round(horizontal * (self.frames - 1))
						);
					});
					return true;
				case 'onmousemove':
					window.addEventListener('resize', function() {
						self.bodyWidth = window.innerWidth;
					});
					window.addEventListener('mousemove', function(e) {
						var horizontal = 1 - (e.pageX / self.bodyWidth || 0);
						self.showFrame(
							Math.round(horizontal * (self.frames - 1))
						);
					});
					return true;
				}
			});
		}
	};

	Lenticular.Image.prototype.showFrame = function(index) {
		// move the last frame out of the viewport
		if (this.lastFrame) {
			this.lastFrame.style.visibility = 'hidden';
		}

		// set the correct frame
		var imageToShow = this.imageSet.frames[index];
		imageToShow.style.visibility = 'visible';
		this.lastFrame = imageToShow;
	};

	Lenticular.Image.prototype.activate = function() {
		this.isActive = true;
	};

	Lenticular.Image.prototype.deactivate = function() {
		this.isActive = false;
	};

	Lenticular.Image.prototype.destroy = function() {
		Lenticular.images.splice(Lenticular.images.indexOf(this), 1);
		if(Lenticular.images.length === 0 && this.useTilt) {
			window.removeEventListener(
				'orientationchange',
				Lenticular.updateOrientation
			);
			window.removeEventListener(
				'deviceorientation',
				Lenticular.updateFrames
			);
		}
	};
}(window, document));
