function inherit_B(Child, Parent)
{
    var F = function () { };
    F.prototype = Parent.prototype;
    var f = new F();
    
    for (var prop in Child.prototype)
    	f[prop] = Child.prototype[prop];

    Child.prototype = f;
    Child.prototype.super = Parent.prototype;
}

function randint(from, to)
{
    return Math.floor(Math.random() * (to - from + 1)) + from;
}

function randfloat(from, to)
{
    return Math.random() * (to - from) + from;
}

function constrain(val, from, to)
{
	if(val > to)
		return to;
	if(val < from)
		return from;

	return val;
}

(function()
{
	var SpriteType =
	{
		STATIC		: 0,
		SWITCH		: 1,
		ANIMATION	: 2
	};

	var LayoutType =
	{
		LINEAR		: 0,
		GRID		: 1
	};

	var gameSize =
	{
		width: 800,
		height: 600
	};

	var entityFiles =
	{
		SHIP			: ["res\\img\\ship.png"],
		SHOT			: ["res\\img\\shot0.png", "res\\img\\shot1.png", "res\\img\\shot2.png"],
		ROCK			: ["res\\img\\rock0.png", "res\\img\\rock1.png", "res\\img\\rock2.png", "res\\img\\rock3.png", "res\\img\\rock4.png", "res\\img\\rock5.png", "res\\img\\rock6.png"],
		BACKGROUND		: ["res\\img\\background0.png", "res\\img\\background1.png", "res\\img\\background2.png", "res\\img\\background3.png", "res\\img\\background4.png", "res\\img\\background5.png"],
		DEBRIS			: ["res\\img\\debris0.png", "res\\img\\debris1.png"],
		EXPLOSION		: ["res\\anim\\explosion0.png", "res\\anim\\explosion1.png", "res\\anim\\explosion2.png", "res\\anim\\explosion3.png", "res\\anim\\explosion4.png", "res\\anim\\explosion5.png"],
		SHIELD			: ["res\\img\\shield0.png", "res\\img\\shield1.png"],
		SHIELD_ICON		: ["res\\img\\shieldIcon.png"]
	};

	var entityImages = {};

	var sndFiles =
	{
		SHOT			: ["res\\snd\\shot0.mp3", "res\\snd\\shot1.mp3"],
		EXPLOSION		: ["res\\snd\\explosion0.mp3", "res\\snd\\explosion1.mp3", "res\\snd\\explosion2.mp3", "res\\snd\\explosion3.mp3"],
		SHIP_EXPLOSION	: ["res\\snd\\shipExplosion.mp3"],
		THRUST_ON		: ["res\\snd\\thrustOn.mp3"],
		THRUST_OFF		: ["res\\snd\\thrustOff.mp3"],
		SOUNDTRACK		: ["res\\snd\\soundtrack.mp3"]
	};

	var sndAudio = {};

	var offsets =	[
						[0, 0],
						[gameSize.width, 0], [-gameSize.width, 0], [0, gameSize.height], [0, -gameSize.height],
						[gameSize.width, gameSize.height], [-gameSize.width, gameSize.height], [gameSize.width, -gameSize.height], [-gameSize.width, -gameSize.height]
					];

	var debrisOffsets = [0, gameSize.width, -gameSize.width];

	var dist = function(obj1, obj2)
	{
		var pos1x	= obj1.pos.x;
		var pos1y	= obj1.pos.y;

		var minDist = undefined;

		var i = offsets.length;
		while(i--)
		{
			var pos2x	= obj2.pos.x + offsets[i][0];
			var pos2y	= obj2.pos.y + offsets[i][1];

			var dst = Math.hypot(pos1x-pos2x, pos1y-pos2y);
			if(minDist === undefined || minDist > dst)
				minDist = dst;
		}

		return minDist;
	}

	var checkCollision = function(obj1, obj2)
	{
		var rad1	= obj1.sprite.radius;
		var rad2	= obj2.sprite.radius;

		return dist(obj1, obj2) < rad1+rad2;
	}
	var checkGroupCollision = function(gr1, gr2)
	{
		col1 = [];
		col2 = [];

		for(var i = 0; i<gr1.length; i++)
		{
			for(var j = 0; j<gr2.length; j++)
			{
				if(checkCollision(gr1[i], gr2[j]))
				{
					if(col1[col1.length-1] != i)
						col1.push(i);
					if(col2[col2.length-1] != j)
						col2.push(j);
				}
			}
		}

		return [col1, col2]
	}

	var fricK = 0.55;
	var ship_ang_vel = 1.5*Math.PI;
	var acc = 400;
	var shotSpeed = 500;
	var maxRocks = 5;
	var shipBufferZone = 100;
	var explLength = 1000;
	var invulnerabilityInterval = 5000;
	var minRockSpeed = 50;
	var maxRockSpeed = 250;
	var FPSUpdatePeriod = 250;
	var clones = 10;

	var DEBUG = false;

	// ================================================================================================================Game================================================================================================================
	var Game = function(canvasId)
	{
		var canvas = document.getElementById(canvasId);
		var ctx = canvas.getContext('2d');

		var self = this;

		this.keyboarder = new Keyboarder();

		self.score = 0;
		self.lives = DEBUG ? NaN : 3;
		self.gameOver = true;

		this.started = false;
		this.resLoaded = false;
		this.sndLoaded = false;
		this.imgLoaded = false;

		this.allResLoaded = function()
		{
			console.log('All resources are loaded');

			self.resLoaded = true;
			self.keyboarder.attachOnkeydown(self.keyboarder.KEY.ENTER, Start);

			self.ship = new Ship();
			self.ship.setPos(gameSize.width/2, gameSize.height/2);
			self.ship.setAngle(Math.PI / 2);
		}

		this.onImgLoaded = function()
		{
			console.log('img loaded');

			self.imgLoaded = true;

			if(self.sndLoaded)
				self.allResLoaded();
		}

		this.onSndLoaded = function()
		{
			console.log('snd loaded');

			self.sndLoaded = true;

			if(self.imgLoaded)
				self.allResLoaded();
		}

		// Create and init resourses
		var preloader = new ImagePreloader(entityFiles, entityImages, this.onImgLoaded);
		preloader.preload();

		var snd_preloader = new SoundPreloader(sndFiles, sndAudio, this.onSndLoaded);
		snd_preloader.preload();

		this.player = new SndPlayer(sndAudio);
		this.player.setVolume("SHIP_EXPLOSION", 0, 1);
		this.player.setVolume("THRUST_ON", 0, 1);
		this.player.setVolume("THRUST_OFF", 0, 1);

		this.ship;

		this.rocks = [];
		this.shots = [];
		this.explosions = [];

		this.debrisPos = [0, 0];
		this.debrisVel = [100, -50];

		this.backgroundId = randint(0, 5);

		var spawnRock = function()
		{
			if(self.rocks.length < maxRocks && self.started && !self.gameOver)
			{
				var rock = new Rock(randint(0,6));

				rock.setPos(randint(0, gameSize.width), randint(0, gameSize.height));

				var angle = randfloat(0, 2*Math.PI);
				var vel = constrain(randfloat(0, 0.5*self.score+10), minRockSpeed, maxRockSpeed);
				rock.setVelocity(vel*Math.cos(angle), vel*Math.sin(angle));

				rock.setAngle(randfloat(-Math.PI, Math.PI));
				rock.setAngularVelocity(randfloat(-Math.PI, Math.PI));

				var scale = 0.8 - self.score*0.0005;
				scale = randfloat(scale-0.4, scale+0.4);
				if(scale < 0.6)
					scale = 0.6;
				rock.setScale(scale);

				if(dist(self.ship, rock) > self.ship.sprite.radius + rock.sprite.radius + shipBufferZone)
					self.rocks.push(rock);
			}
		}

		this.prevTickTime = Date.now();
		this.realFPS = 0;
		var tick = function()
		{
			var now = Date.now();
			var dt = now - self.prevTickTime;
			self.prevTickTime = now;

			if(self.updateFPS)
			{
				self.realFPS = 1000 / dt;

				self.updateFPS = false;
			}

			self.update(dt);
			self.draw(ctx);
			requestAnimationFrame(tick);
		};

		self.updateFPS = false;
		var nextFPS = function()
		{
			self.updateFPS = true;
		}
		setInterval(nextFPS, FPSUpdatePeriod);

		var ThrustOn = function()
		{
			self.ship.setThrust(true);
			self.player.play("THRUST_ON", 0, false);
		};
		var ThrustOff = function()
		{
			self.ship.setThrust(false);
			self.player.stop("THRUST_ON");
			self.player.play("THRUST_OFF", 0, false);
		};

		var TurnLeft = function()
		{
			self.ship.ang_vel += ship_ang_vel;
		};
		var TurnRight = function()
		{
			self.ship.ang_vel -= ship_ang_vel;
		};

		var Shoot = function()
		{
			if(self.ship.isOnCanvas)
			{
				var shot = new Shot(2);

				shot.setVelocity(self.ship.velocity.x + shotSpeed * Math.cos(self.ship.angle), self.ship.velocity.y - shotSpeed * Math.sin(self.ship.angle));
				shot.setPos(self.ship.pos.x + self.ship.sprite.radius * Math.cos(self.ship.angle), self.ship.pos.y - self.ship.sprite.radius * Math.sin(self.ship.angle));
				shot.setAngle(self.ship.angle);
				self.shots.push(shot);

				self.player.play("SHOT", randint(0, 1), false);
			}
		};

		var Start = function()
		{
			if(self.gameOver)
			{
				self.started = true;
				self.gameOver = false;

				self.score = 0;
				self.lives = DEBUG ? NaN : 3;

				self.keyboarder.attachOnkeydown(self.keyboarder.KEY.W, ThrustOn);
				self.keyboarder.attachOnkeyup(self.keyboarder.KEY.W, ThrustOff);

				self.keyboarder.attachOnkeydown(self.keyboarder.KEY.A, TurnLeft);
				self.keyboarder.attachOnkeyup(self.keyboarder.KEY.A, TurnRight);
				self.keyboarder.attachOnkeydown(self.keyboarder.KEY.D, TurnRight);
				self.keyboarder.attachOnkeyup(self.keyboarder.KEY.D, TurnLeft);

				self.keyboarder.attachOnkeydown(self.keyboarder.KEY.SPACE, Shoot);

				self.player.play("SOUNDTRACK", 0, true);
			}
		}



		//setInterval(tick, 1000 / FPS);
		tick();
		setInterval(spawnRock, 1000);
	};

	Game.prototype =
	{
		update: function(dt)
		{
			if(this.resLoaded)
			{

				this.debrisPos[0] += this.debrisVel[0] * dt / 1000;
				this.debrisPos[1] += this.debrisVel[1] * dt / 1000;

				this.debrisPos[0] = this.debrisPos[0] % (gameSize.width)
				if(this.debrisPos[0] < 0)
					this.debrisPos[0] += gameSize.width;

				this.debrisPos[1] = this.debrisPos[1] % (gameSize.width)
				if(this.debrisPos[1] < 0)
					this.debrisPos[1] += gameSize.width;

				this.ship.update(dt);

				var i = this.shots.length;
				while(i--)
				{
					this.shots[i].update(dt);
					if(this.shots[i].obsolete())
						this.shots.splice(i, 1);
				}

				var i = this.rocks.length;
				while(i--)
				{
					this.rocks[i].update(dt);
				}

				var i = this.explosions.length;
				while(i--)
				{
					this.explosions[i].update(dt);
					if(this.explosions[i].sprite.animEnded)
					{
						this.explosions.splice(i, 1);
					}
				}

				// Check rock-shot collisions

				var toDelete = checkGroupCollision(this.shots, this.rocks);
				var toDelShots = toDelete[0];
				var toDelRocks = toDelete[1];

				var i = toDelShots.length;
				while(i--)
				{
					var ind = toDelShots[i];
					this.shots.splice(ind, 1);
				}
				var i = toDelRocks.length;
				while(i--)
				{
					var ind = toDelRocks[i];
					var rock = this.rocks[ind];
					this.rocks.splice(ind, 1);

					if(rock === undefined)
					{
						console.log('Shit is about to happen');

						console.log('ind=' + ind);

						console.log('toDelRocks:');
						console.log(toDelRocks);

						console.log('this.rocks:');
						console.log(this.rocks);
					}

					var explosion = new Explosion(randint(0, 4), explLength);
					explosion.setPos(rock.pos.x, rock.pos.y);
					explosion.setVelocity(rock.velocity.x, rock.velocity.y);
					explosion.setAngle(Math.atan2(-rock.velocity.y, rock.velocity.x) + 0.5*Math.PI);
					explosion.matchRock(rock.sprite.radius);
					explosion.explode();

					this.explosions.push(explosion);

					this.player.play("EXPLOSION", randint(0,3), false);

					if(rock.sprite.scale > 0.5)
					{
						rock1 = new Rock(rock.type);
						rock2 = new Rock(rock.type);

						rock1.setScale(0.6*rock.sprite.scale);
						rock2.setScale(0.6*rock.sprite.scale);

						rock1.setPos(rock.pos.x, rock.pos.y);
						rock2.setPos(rock.pos.x, rock.pos.y);

						var vel = Math.hypot(rock.velocity.x, rock.velocity.y);
						var angle = Math.atan2(rock.velocity.y, rock.velocity.x);

						dAngle = randfloat(Math.PI/12, Math.PI/3);

						rock1.setVelocity(vel*Math.cos(angle + dAngle), vel*Math.sin(angle + dAngle));
						rock2.setVelocity(vel*Math.cos(angle - dAngle), vel*Math.sin(angle - dAngle));

						rock1.setAngularVelocity(rock.ang_vel);
						rock2.setAngularVelocity(-rock.ang_vel);

						this.rocks.push(rock1);
						this.rocks.push(rock2);
					}
				}

				this.score += 5*toDelRocks.length;

				// Check rock-ship collisions
				if(this.ship.isOnCanvas)
				{
					var toDelete = checkGroupCollision([this.ship], this.rocks);
					var toDelShip = toDelete[0];
					var toDelRocks = toDelete[1];

					var i = toDelRocks.length;
					while(i--)
					{
						ind = toDelRocks[i];
						rock = this.rocks[ind];
						this.rocks.splice(ind, 1);

						explosion = new Explosion(randint(0, 4), explLength);
						explosion.setPos(rock.pos.x, rock.pos.y);
						explosion.setVelocity(rock.velocity.x, rock.velocity.y);
						explosion.setAngle(Math.atan2(-rock.velocity.y, rock.velocity.x) + 0.5*Math.PI);
						explosion.matchRock(rock.sprite.radius);
						explosion.explode();

						this.explosions.push(explosion);
						if(this.ship.invulnerable)
							this.player.play("EXPLOSION", randint(0,3), false);
					}

					if(toDelShip.length > 0 && !this.ship.invulnerable)
					{
						this.lives--;

						explosion = new Explosion(5, explLength);
						explosion.setPos(this.ship.pos.x, this.ship.pos.y);
						explosion.setVelocity(this.ship.velocity.x, this.ship.velocity.y);
						explosion.setAngle(Math.atan2(-this.ship.velocity.y, this.ship.velocity.x) + 0.5*Math.PI);
						explosion.matchRock(2*this.ship.sprite.radius);
						explosion.explode();

						this.explosions.push(explosion);

						this.player.play("SHIP_EXPLOSION", 0, false);

						this.ship.reset(2000);

						if(this.lives <= 0)
						{
							this.gameOver = true;
							this.rocks = [];
						}
					}
				}
			}
		},

		draw: function(ctx)
		{
			if(!this.resLoaded)
			{
				ctx.clearRect(0, 0, gameSize.width, gameSize.height);
				ctx.font="20px Georgia"
				ctx.fillStyle = '#000000';
				ctx.fillText("Loading, please wait", 10, 30);
			}

			else if(!this.started)
			{
				ctx.drawImage(entityImages.BACKGROUND[this.backgroundId], 0, 0);
				ctx.font="20px Georgia"
				ctx.fillStyle = '#FFFFFF';
				ctx.fillText("Press Enter to begin the enthralling unforgettable journey into my WTFcode.", 10, 30);
			}
			else
			{
				ctx.drawImage(entityImages.BACKGROUND[this.backgroundId], 0, 0);

				var i = debrisOffsets.length;
				while(i--)
				{
					ctx.drawImage(entityImages.DEBRIS[0], this.debrisPos[0] + debrisOffsets[i], 0);
					ctx.drawImage(entityImages.DEBRIS[1], this.debrisPos[1] + debrisOffsets[i], 0);
				}

				var i = this.explosions.length;
				while(i--)
				{
					this.explosions[i].draw(ctx);
				}

				var i = this.rocks.length;
				while(i--)
				{
					this.rocks[i].draw(ctx);
				}

				this.ship.draw(ctx);

				var i = this.shots.length;
				while(i--)
				{
					this.shots[i].draw(ctx);
				}

				ctx.font="20px Georgia"
				ctx.fillStyle = '#FFFFFF';
				ctx.fillText("Score: "+this.score, 10, 30);
				if(this.gameOver)
					ctx.fillText("Game over. Press Enter to play again", 10, 60);
				else
					ctx.fillText("Lives: "+this.lives, 10, 60);

				if(DEBUG)
				{
					ctx.fillStyle = '#FF0000';
					ctx.fillText("Debug mode", 10, 90);
				}

				if(this.ship.invulnerable)
				{
					ctx.drawImage(entityImages.SHIELD_ICON[0], 10, 100);
				}

				ctx.fillStyle = '#FFFF00';
				ctx.font = '30pt Calibri';
				ctx.fillText(Math.round(this.realFPS), gameSize.width - 70, 50);
			}
		}
	};

	// ================================================================================================================ImagePreloader================================================================================================================
	var ImagePreloader = function(input, output, onLoadedCallback)
	{
		this.numberImages = 0;
		this.numberLoaded = 0;
		this.onLoadedCallback = onLoadedCallback;

		this.input = input;
		this.output = output;

		var self = this;

		this.onLoaded = function()
		{
			self.numberLoaded++;
			if(self.allLoaded())
				self.onLoadedCallback();
		}
	}
	ImagePreloader.prototype =
	{
		preload: function()
		{
			for(var key in this.input)
			{
				this.numberImages += this.input[key].length;

				this.output[key] = [];

				for(var i = 0; i<this.input[key].length; i++)
				{
					var filename = this.input[key][i];

					var img = new Image();
					img.onload = this.onLoaded;
					img.src = filename;

					this.output[key].push(img);
				}
			}
		},

		allLoaded: function()
		{
			return (this.numberImages != 0) && (this.numberImages == this.numberLoaded);
		}
	}

	// ================================================================================================================SoundPreloader================================================================================================================
	var SoundPreloader = function(input, output, onLoadedCallback)
	{
		this.numberImages = 0;
		this.numberLoaded = 0;
		this.onLoadedCallback = onLoadedCallback;

		this.input = input;
		this.output = output;

		var self = this;

		this.oncanplaythrough = function()
		{
			self.numberLoaded++;
			if(self.allLoaded())
				self.onLoadedCallback();
		}
	}
	SoundPreloader.prototype =
	{
		preload: function()
		{
			for(var key in this.input)
			{
				this.numberImages += this.input[key].length;

				this.output[key] = [];

				for(var i = 0; i<this.input[key].length; i++)
				{
					var filename = this.input[key][i];

					var snd = new Audio();
					snd.oncanplaythrough = this.oncanplaythrough;
					snd.src = filename;
					snd.volume = 0.5;

					this.output[key].push(snd);
				}
			}
		},

		allLoaded: function()
		{
			return (this.numberImages != 0) && (this.numberImages == this.numberLoaded);
		}
	}

	// ================================================================================================================SndPlayer================================================================================================================
	var SndPlayer = function(sndArray)
	{
		this.sounds = {};
		this.free = {};

		for(var key in sndArray)
		{
			this.sounds[key] = [];
			this.free[key] = [];

			for(var i = 0; i<sndArray[key].length; i++)
			{
				this.sounds[key].push([]);
				this.free[key].push([]);

				var snd = sndArray[key][i];
				for(var j = 0; j < clones; j++)
				{
					this.sounds[key][i].push(snd.cloneNode());
					this.sounds[key][i][j].volume = 0.5;
					this.free[key][i].push(true);
				}
			}
		}

		console.log(this.sounds);
	}
	SndPlayer.prototype =
	{
		play: function(key, ind, looped)
		{
			//var sounds = this.sounds[key][ind];

			for(var i = 0; i<this.free[key][ind].length; i++)
			{
				if(this.free[key][ind][i])
				{
					var self = this;
					var freeSound = function()
					{
						if(looped)
						{
							self.sounds[key][ind][i].currentTime = 0;
							self.sounds[key][ind][i].play();
						}
						else
							self.free[key][ind][i] = true;
					}
					this.sounds[key][ind][i].play();
					this.sounds[key][ind][i].onended = freeSound;

					this.free[key][ind][i] = false;

					break;
				}
			}
		},

		stop: function(key)
		{
			for(var ind = 0; ind < this.sounds[key].length; ind++)
			{
				for(var i = 0; i<clones; i++)
				{
					this.sounds[key][ind][i].pause();
					this.sounds[key][ind][i].currentTime = 0;
					this.free[key][ind][i] = true;
				}
			}
		},

		setVolume: function(key, ind, vol)
		{
			for(var i = 0; i<clones; i++)
				this.sounds[key][ind][i].volume = vol;
		}
	}

	// ================================================================================================================Sprite================================================================================================================
	var Sprite = function(obj, entityImg, layout, frames, dim, animLength)
	{
		this.layout = layout;
		this.dim = dim;
		this.obj = obj;
		this.totalFrames = frames;
		this.img = entityImg;
		this.animLength = animLength;

		this.size =
		{
			width	: this.img.naturalWidth,
			height	: this.img.naturalHeight
		};

		this.cols = 1;
		this.rows = 1;

		this.scale = 1;

		this.frameSize = this.size;

		switch(this.layout)
		{
			case LayoutType.LINEAR:
				this.cols = this.dim;
				this.rows = 1;

				this.frameSize.width = this.size.width / this.dim;
				this.frameSize.height = this.size.width;
				break;

			case LayoutType.GRID:
				this.cols = this.dim;
				this.rows = this.dim;

				this.frameSize.width = this.size.width / this.dim;
				this.frameSize.height = this.size.height / this.dim;
				break;
		}

		this.radius;

		this.calcRadius();

		this.curFrame = 0;

		this.timerId = -1;
		this.animEnded = false;

		this.alpha = 1;
	}

	Sprite.prototype =
	{
		draw: function(ctx)
		{
			for(var i = 0; i<offsets.length; i++)
			{
				ctx.save();

				ctx.translate(this.obj.pos.x + offsets[i][0], this.obj.pos.y + offsets[i][1]);
				ctx.rotate(-this.obj.angle);
				ctx.globalAlpha = this.alpha;

				var col = this.curFrame % this.cols;
				var row = ~~(this.curFrame / this.cols); // integer division

				var sx = col * this.frameSize.width;
				var sy = row * this.frameSize.height;

				var left = - this.frameSize.width / 2 * this.scale;
				var top = - this.frameSize.height / 2 * this.scale;

				ctx.drawImage(this.img, sx, sy, this.frameSize.width, this.frameSize.height, left, top, this.frameSize.width * this.scale, this.frameSize.height * this.scale);

				if(DEBUG)
				{
					ctx.beginPath();
					ctx.arc(0, 0, this.radius, 0, 2*Math.PI);
					ctx.strokeStyle = "#0000FF";
					ctx.stroke();
				}

				ctx.restore();
			}
		},

		runAnimation: function(animLength)
		{
			var dt = animLength / this.totalFrames;
			var self = this;
			var nextFrame = function()
			{
				self.curFrame++;
				if(self.curFrame > self.totalFrames)
				{
					clearInterval(self.timerId);
					self.animEnded = true;
				}
			}
			this.timerId = setInterval(nextFrame, dt);
		},

		fadeAwayFor: function(period)
		{
			var self = this;
			var steps = 100;
			var delta = 1/steps;
			var nextStep = function()
			{
				self.alpha -= delta;
				if(self.alpha <= 0)
				{
					clearInterval(self.timerId);
				}
			}

			this.alpha = 1;
			this.timerId = setInterval(nextStep, period / steps);
		},

		setScale: function(scale)
		{
			this.scale = scale;
			this.calcRadius();
		},

		setFrame: function(frame)
		{
			this.curFrame = frame;
		},

		calcRadius: function()
		{
			this.radius = this.frameSize.width / 2 * this.scale;
		},

		setAlpha: function(alpha)
		{
			this.alpha = alpha;
		}
	}

	// ================================================================================================================Entity================================================================================================================
	var Entity = function()
	{
		this.sprite = undefined;
		this.pos =
		{
			x: 0,
			y: 0
		};
		this.velocity =
		{
			x: 0,
			y: 0
		};

		this.angle = 0;
		this.ang_vel = 0;
	}
	Entity.prototype =
	{
		update: function(dt)
		{
			this.angle += this.ang_vel * dt / 1000;

			this.pos.x += this.velocity.x * dt / 1000;
			this.pos.y += this.velocity.y * dt / 1000;

			this.pos.x = this.pos.x % (gameSize.width)
			if(this.pos.x < 0)
				this.pos.x += gameSize.width;

			this.pos.y = this.pos.y % (gameSize.height)
			if(this.pos.y < 0)
				this.pos.y += gameSize.height;
		},

		draw: function(ctx)
		{
			this.sprite.draw(ctx);
		},

		setPos: function(x, y)
		{
			this.pos.x = x;
			this.pos.y = y;
		},

		setAngle: function(angle)
		{
			this.angle = angle;
		},

		setVelocity: function(velx, vely)
		{
			this.velocity.x = velx;
			this.velocity.y = vely;
		},

		setAngularVelocity: function(ang_vel)
		{
			this.ang_vel = ang_vel;
		},

		setScale: function(scale)
		{
			this.sprite.setScale(scale);
		}
	}

	// ================================================================================================================Ship================================================================================================================
	var Ship = function()
	{
		Entity.call(this);
		this.sprite = new Sprite(this, entityImages.SHIP[0], LayoutType.LINEAR, 2, 2);
		this.sprite.setFrame(0);

		this.shield = new Shield();

		this.thrust = false;

		this.invulnerable = false;

		this.isOnCanvas = true;
	}
	Ship.prototype =
	{
		draw: function(ctx)
		{
			if(this.isOnCanvas)
			{
				this.super.draw.apply(this, [ctx]);
				if(this.invulnerable)
				{
					this.shield.draw(ctx);
				}

				if(DEBUG)
				{
					for(var i = 0; i<offsets.length; i++)
					{
						ctx.beginPath();
						ctx.arc(this.pos.x + offsets[i][0], this.pos.y + offsets[i][1], this.sprite.radius+shipBufferZone, 0, 2*Math.PI);
						ctx.strokeStyle = "#FF0000";
						ctx.stroke();
					}
				}
			}
		},

		update: function(dt)
		{
			if(this.thrust)
			{
				this.velocity.x += acc * Math.cos(this.angle) * dt / 1000;
				this.velocity.y -= acc * Math.sin(this.angle) * dt / 1000;
			}
			this.velocity.x *= (1-fricK * dt / 1000);
			this.velocity.y *= (1-fricK * dt / 1000);

			this.shield.update(dt);

			this.super.update.apply(this, [dt]);
		},

		setThrust: function(thrust)
		{
			this.thrust = thrust;
			this.sprite.setFrame(thrust);
		},

		setInvulnerabilityFor: function(timeout)
		{
			var self = this;
			this.invulnerable = true;
			this.shield.pos = this.pos;
			this.shield.setAngularVelocity(Math.PI);
			this.shield.sprite.fadeAwayFor(timeout);

			var onTimeoutEnd = function()
			{
				self.invulnerable = false;
			}
			setTimeout(onTimeoutEnd, timeout);
		},

		reset: function(timeout)
		{
			this.isOnCanvas = false;
			var self = this;
			var showShip = function()
			{
				self.setPos(gameSize.width/2, gameSize.height/2);
				self.setAngle(Math.PI / 2);
				self.setVelocity(0, 0);
				self.setInvulnerabilityFor(invulnerabilityInterval);
				self.isOnCanvas = true;
			}
			setTimeout(showShip, timeout);
		}
	}
	inherit_B(Ship, Entity);

	// ================================================================================================================Shield================================================================================================================
	var Shield = function()
	{
		Entity.call(this);
		this.sprite = new Sprite(this, entityImages.SHIELD[0], LayoutType.LINEAR, 1, 1);
		this.sprite.setFrame(0);
	}
	Shield.prototype =
	{
		
	}
	inherit_B(Shield, Entity);

	// ================================================================================================================Shot================================================================================================================
	var Shot = function(type)
	{
		Entity.call(this);
		this.sprite = new Sprite(this, entityImages.SHOT[type], LayoutType.LINEAR, 1, 1);

		this.lifespan = 1000;
	}
	Shot.prototype =
	{
		update: function(dt)
		{
			this.super.update.apply(this, [dt]);
			this.lifespan -= dt;
		},

		obsolete: function()
		{
			return this.lifespan <= 0;
		}
	}
	inherit_B(Shot, Entity);

	// ================================================================================================================Rock================================================================================================================
	var Rock = function(type)
	{
		Entity.call(this);
		this.sprite = new Sprite(this, entityImages.ROCK[type], LayoutType.LINEAR, 1, 1);
		this.type = type;
	}
	Rock.prototype =
	{
		// update: function(dt)
		// {
		// 	this.super.update.apply(this, [dt]);
		// }
	}
	inherit_B(Rock, Entity);

	// ================================================================================================================Explosion================================================================================================================
	var Explosion = function(type, animLength)
	{
		Entity.call(this);
		this.sprite = new Sprite(this, entityImages.EXPLOSION[type], LayoutType.GRID, 64, 8);

		this.animLength = animLength;
	}
	Explosion.prototype =
	{
		explode: function()
		{
			this.sprite.runAnimation(this.animLength);
		},

		matchRock: function(radius)
		{
			this.sprite.scale = radius / this.sprite.radius * 2;
		}
	}
	inherit_B(Explosion, Entity);

	// ================================================================================================================Keyboarder================================================================================================================
	var Keyboarder = function()
	{
		var keyState = {};

		var handled = {};

		var mapdown = {};
		var mapup = {};

		window.onkeydown = function(event)
		{
			keyState[event.keyCode] = true;
			if(event.keyCode in mapdown && !handled[event.keyCode])
				(mapdown[event.keyCode])();

			handled[event.keyCode] = true;
		};

		window.onkeyup = function(event)
		{
			keyState[event.keyCode] = false;
			if(event.keyCode in mapup)
				(mapup[event.keyCode])();

			handled[event.keyCode] = false;
		};

		this.isDown = function(keyCode)
		{
			return keyState[keyCode] == true;
		};

		this.attachOnkeydown = function(keyCode, func)
		{
			mapdown[keyCode] = func;
		};

		this.attachOnkeyup = function(keyCode, func)
		{
			mapup[keyCode] = func;
		};

		this.KEY = {
			W		: 87,
			A		: 65,
			S		: 83,
			D		: 68,
			SPACE	: 32,
			ENTER	: 13
		};
	};

	window.onload = function()
	{
		new Game("screen");
	};
})();
