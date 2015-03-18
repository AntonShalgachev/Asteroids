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
		BACKGROUND		: ["res\\img\\background0.png", "res\\img\\background1.png"],
		DEBRIS			: ["res\\img\\debris0.png", "res\\img\\debris1.png"],
		EXPLOSION		: ["res\\anim\\explosion0.png", "res\\anim\\explosion1.png", "res\\anim\\explosion2.png", "res\\anim\\explosion3.png", "res\\anim\\explosion4.png", "res\\anim\\explosion5.png"]
	};

	var entityImages = {};

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

		// var pos1x	= obj1.pos.x;
		// var pos1y	= obj1.pos.y;

		// var i = offsets.length;
		// while(i--)
		// {
		// 	var pos2x	= obj2.pos.x + offsets[i][0];
		// 	var pos2y	= obj2.pos.y + offsets[i][1];

		// 	var dst = Math.hypot(pos1x-pos2x, pos1y-pos2y);
		// 	if(dst < rad1+rad2)
		// 		return true;
		// }

		// return false;

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

	var FPS = 60;

	var fricK = 0.01;
	var ship_ang_vel = 1.5*Math.PI;
	var acc = 400;
	var shotSpeed = 500;
	var maxRocks = 10;
	var shipBufferZone = 100;
	var explLength = 1000;
	var invulnerabilityInterval = 5000;

	var DEBUG = true;

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

		this.onResLoaded = function()
		{
			self.resLoaded = true;
			self.keyboarder.attachOnkeydown(self.keyboarder.KEY.ENTER, Start);

			self.ship = new Ship();
			self.ship.setPos(gameSize.width/2, gameSize.height/2);
			self.ship.setAngle(Math.PI / 2);
		}

		// Create and init resourses
		var preloader = new Preloader(this.onResLoaded);
		preloader.preload();

		this.ship;

		this.rocks = [];
		this.shots = [];
		this.explosions = [];

		this.debrisPos = [0, 0];
		this.debrisVel = [100, -50];

		var spawnRock = function()
		{
			if(self.rocks.length < maxRocks && self.started && !self.gameOver)
			{
				var rock = new Rock(randint(0,6), 1);
				rock.setPos(randint(0, gameSize.width), randint(0, gameSize.height));
				var velx = randfloat(-0.5*self.score-10, 0.5*self.score+10);
				var vely = randfloat(-0.5*self.score-10, 0.5*self.score+10);
				if(Math.hypot(velx, vely) > 400)
				{
					var vel = Math.hypot(velx, vely);
					var c = 400 / vel;
					velx = velx * c;
					vely = vely * c;
				}
				rock.setVelocity(velx, vely);
				rock.setAngularVelocity(randfloat(-Math.PI, Math.PI));
				rock.setAngle(randfloat(-Math.PI, Math.PI));
				var scale = 0.8 - self.score*0.0005;
				scale = randfloat(scale-0.2, scale+0.2);
				if(scale < 0.3)
					scale = 0.3;
				rock.setScale(scale);

				if(dist(self.ship, rock) > self.ship.sprite.radius + rock.sprite.radius + shipBufferZone)
					self.rocks.push(rock);
			}
		}

		var tick = function()
		{
			self.update();
			self.draw(ctx);
		};



		var ThrustOn = function()
		{
				self.ship.setThrust(true);
		};
		var ThrustOff = function()
		{
				self.ship.setThrust(false);
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
			var shot = new Shot(2);

			shot.setVelocity(self.ship.velocity.x + shotSpeed * Math.cos(self.ship.angle), self.ship.velocity.y - shotSpeed * Math.sin(self.ship.angle));
			shot.setPos(self.ship.pos.x + self.ship.sprite.radius * Math.cos(self.ship.angle), self.ship.pos.y - self.ship.sprite.radius * Math.sin(self.ship.angle));
			shot.setAngle(self.ship.angle);
			self.shots.push(shot);
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
			}
		}



		setInterval(tick, 1000 / FPS);
		setInterval(spawnRock, 1000);
	};

	Game.prototype =
	{
		update: function()
		{
			if(this.resLoaded)
			{
				dt = 1000/FPS;

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
					ind = toDelShots[i];
					this.shots.splice(ind, 1);
				}
				var i = toDelRocks.length;
				while(i--)
				{
					ind = toDelRocks[i];
					rock = this.rocks[ind];
					this.rocks.splice(ind, 1);

					explosion = new Explosion(randint(0, 4), 1, explLength);
					explosion.setPos(rock.pos.x, rock.pos.y);
					explosion.setVelocity(rock.velocity.x, rock.velocity.y);
					explosion.setAngle(Math.atan2(-rock.velocity.y, rock.velocity.x) + 0.5*Math.PI);
					explosion.matchRock(rock.sprite.radius);
					explosion.explode();

					this.explosions.push(explosion);

					//smallRock1 = new Rock();
				}

				this.score += 10*toDelRocks.length;

				// Check rock-ship collisions
				var toDelete = checkGroupCollision([this.ship], this.rocks);
				var toDelShip = toDelete[0];
				var toDelRocks = toDelete[1];

				var i = toDelRocks.length;
				while(i--)
				{
					ind = toDelRocks[i];
					rock = this.rocks[ind];
					this.rocks.splice(ind, 1);

					explosion = new Explosion(randint(0, 4), 1, explLength);
					explosion.setPos(rock.pos.x, rock.pos.y);
					explosion.setVelocity(rock.velocity.x, rock.velocity.y);
					explosion.setAngle(Math.atan2(-rock.velocity.y, rock.velocity.x) + 0.5*Math.PI);
					explosion.matchRock(rock.sprite.radius);
					explosion.explode();

					this.explosions.push(explosion);
				}

				if(toDelShip.length > 0 && !this.ship.invulnerable)
				{
					this.lives--;

					explosion = new Explosion(5, 1, explLength);
					explosion.setPos(this.ship.pos.x, this.ship.pos.y);
					explosion.setVelocity(this.ship.velocity.x, this.ship.velocity.y);
					explosion.setAngle(Math.atan2(-this.ship.velocity.y, this.ship.velocity.x) + 0.5*Math.PI);
					explosion.matchRock(2*this.ship.sprite.radius);
					explosion.explode();

					this.explosions.push(explosion);

					this.ship.setPos(gameSize.width/2, gameSize.height/2);
					this.ship.setAngle(Math.PI / 2);
					this.ship.setVelocity(0, 0);
					this.ship.setInvulnerabilityFor(invulnerabilityInterval);

					if(this.lives <= 0)
					{
						this.gameOver = true;
						this.rocks = [];
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
				ctx.drawImage(entityImages.BACKGROUND[1], 0, 0);
				ctx.font="20px Georgia"
				ctx.fillStyle = '#FFFFFF';
				ctx.fillText("Press Enter to begin the enthralling unforgettable journey into my WTFcode.", 10, 30);
			}
			else
			{
				ctx.drawImage(entityImages.BACKGROUND[1], 0, 0);

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
			}
		}
	};

	// ================================================================================================================Preloader================================================================================================================
	var Preloader = function(onLoadedCallback)
	{
		this.numberImages = 0;
		this.numberLoaded = 0;
		this.onLoadedCallback = onLoadedCallback;

		var self = this;

		this.onLoaded = function()
		{
			self.numberLoaded++;
			if(self.allLoaded())
				self.onLoadedCallback();
		}
	}
	Preloader.prototype =
	{
		preload: function()
		{
			for(var key in entityFiles)
			{
				this.numberImages += entityFiles[key].length;

				entityImages[key] = [];

				for(var i = 0; i<entityFiles[key].length; i++)
				{
					var filename = entityFiles[key][i];

					var img = new Image();
					img.onload = this.onLoaded;
					img.src = filename;

					entityImages[key].push(img);
				}
			}
		},

		allLoaded: function()
		{
			return (this.numberImages != 0) && (this.numberImages == this.numberLoaded);
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

		this.thrust = false;

		this.invulnerable = false;
	}
	Ship.prototype =
	{
		draw: function(ctx)
		{
			this.super.draw.apply(this, [ctx]);
			if(this.invulnerable)
			{
				for(var i = 0; i<offsets.length; i++)
				{
					ctx.beginPath();
					ctx.arc(this.pos.x + offsets[i][0], this.pos.y + offsets[i][1], this.sprite.radius, 0, 2*Math.PI);
					ctx.strokeStyle = "#00FF00";
					ctx.stroke();
				}
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
		},

		update: function(dt)
		{
			if(this.thrust)
			{
				this.velocity.x += acc * Math.cos(this.angle) * dt / 1000;
				this.velocity.y -= acc * Math.sin(this.angle) * dt / 1000;
			}
			this.velocity.x *= (1-fricK);
			this.velocity.y *= (1-fricK);

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
			var onTimeoutEnd = function()
			{
				self.invulnerable = false;
			}
			setTimeout(onTimeoutEnd, timeout);
		}
	}
	inherit_B(Ship, Entity);

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
	var Rock = function(type, size)
	{
		Entity.call(this);
		this.sprite = new Sprite(this, entityImages.ROCK[type], LayoutType.LINEAR, 1, 1);

		this.size = size;
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
	var Explosion = function(type, size, animLength)
	{
		Entity.call(this);
		this.sprite = new Sprite(this, entityImages.EXPLOSION[type], LayoutType.GRID, 64, 8);

		this.size = size;
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
