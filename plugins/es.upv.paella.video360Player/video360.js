
(() => {

function buildVideo360Canvas(stream, canvas) {
	class Video360Canvas extends bg.app.WindowController {

		constructor(stream) {
			super();
			this.stream = stream;
		}

		get video() {
			return this.texture ? this.texture.video : null;
		}

		loaded() {
			return new Promise((resolve) => {
				let checkLoaded = () => {
					if (this.video) {
						resolve(this);
					}
					else {
						setTimeout(checkLoaded,100);
					}
				}
				checkLoaded();
			});
		}

		buildScene() {
		this._root = new bg.scene.Node(this.gl, "Root node");
		
		bg.base.Loader.RegisterPlugin(new bg.base.TextureLoaderPlugin());
		bg.base.Loader.RegisterPlugin(new bg.base.VideoTextureLoaderPlugin());
		bg.base.Loader.RegisterPlugin(new bg.base.VWGLBLoaderPlugin());
		
		bg.base.Loader.Load(this.gl,this.stream.src)
			.then((texture) => {
				this.texture = texture;
				let sphere = bg.scene.PrimitiveFactory.Sphere(this.gl,1,50);
				let sphereNode = new bg.scene.Node(this.gl);
				sphereNode.addComponent(sphere);
				sphere.getMaterial(0).texture = texture;
				sphere.getMaterial(0).lightEmission = 0.0;
				sphere.getMaterial(0).lightEmissionMaskInvert = false;
				sphere.getMaterial(0).cullFace = false;
				sphereNode.addComponent(new bg.scene.Transform(bg.Matrix4.Scale(1,-1,1)));
				this._root.addChild(sphereNode);
			});
		
		let lightNode = new bg.scene.Node(this.gl,"Light");
		let l = new bg.base.Light();
		l.ambient = bg.Color.White();
		l.diffuse = bg.Color.Black();
		l.specular = bg.Color.Black();
		lightNode.addComponent(new bg.scene.Light(l));
		this._root.addChild(lightNode);
		
		this._camera = new bg.scene.Camera();
		let cameraNode = new bg.scene.Node("Camera");
		cameraNode.addComponent(this._camera);			
		cameraNode.addComponent(new bg.scene.Transform(bg.Matrix4.Translation(0,0,0)));
		let oc = new bg.manipulation.OrbitCameraController();
		cameraNode.addComponent(oc);
		oc.maxPitch = 90;
		oc.minPitch = -90;
		oc.maxDistance = 0;
		oc.minDistace = 0;
		this._root.addChild(cameraNode);
	}
    
	init() {
		bg.Engine.Set(new bg.webgl1.Engine(this.gl));
		
        this.buildScene();
		
		this._renderer = bg.render.Renderer.Create(this.gl,bg.render.RenderPath.FORWARD);
		
		this._inputVisitor = new bg.scene.InputVisitor();
	}
    
    frame(delta) {
		if (this.texture) {
			this.texture.update();
		}
		this._renderer.frame(this._root, delta);
		this.postReshape();
	}
	
	display() { this._renderer.display(this._root, this._camera); }
	
	reshape(width,height) {
		this._camera.viewport = new bg.Viewport(0,0,width,height);
		this._camera.projection.perspective(60,this._camera.viewport.aspectRatio,0.1,100);
	}
	
	// Pass the input events to the scene
	mouseDown(evt) {
		this._inputVisitor.mouseDown(this._root,evt);
	}
	
	mouseDrag(evt) {
		this._inputVisitor.mouseDrag(this._root,evt);
		this.postRedisplay();
	}
	
	mouseWheel(evt) {
		this._inputVisitor.mouseWheel(this._root,evt);
		this.postRedisplay();
	}
	
	touchStart(evt) {
		this._inputVisitor.touchStart(this._root,evt);
	}
	
	touchMove(evt) {
		this._inputVisitor.touchMove(this._root,evt);
		this.postRedisplay();
	}
	
	// You may pass also the following events, but they aren't used by the camera controller
	mouseUp(evt) { this._inputVisitor.mouseUp(this._root,evt); }
	mouseMove(evt) { this._inputVisitor.mouseMove(this._root,evt); }
	mouseOut(evt) { this._inputVisitor.mouseOut(this._root,evt); }
	touchEnd(evt) { this._inputVisitor.touchEnd(this._root,evt); }
	}

	let controller = new Video360Canvas(stream);
	let mainLoop = bg.app.MainLoop.singleton;

	mainLoop.updateMode = bg.app.FrameUpdate.AUTO;
	mainLoop.canvas = canvas;
	mainLoop.run(controller);

	return controller.loaded();
}

class Video360 extends paella.VideoElementBase {

	constructor(id,stream,left,top,width,height,streamName) {
		super(id,stream,'canvas',0,0,1280,720);

		this._posterFrame = null;
		this._currentQuality = null;
		this._autoplay = false;
		this._streamName = null;

		this._streamName = streamName || 'video360';
		var This = this;

		paella.player.videoContainer.disablePlayOnClick();

		if (this._stream.sources[this._streamName]) {
			this._stream.sources[this._streamName].sort(function (a, b) {
				return a.res.h - b.res.h;
			});
		}

		this.video = null;

		function onProgress(event) {
			if (!This._ready && This.video.readyState==4) {
				This._ready = true;
				if (This._initialCurrentTipe!==undefined) {
					This.video.currentTime = This._initialCurrentTime;
					delete This._initialCurrentTime;
				}
				This._callReadyEvent();
			}
		}

		function evtCallback(event) { onProgress.apply(This,event); }

		function onUpdateSize() {
			if (This.canvasController) {
				let canvas = This.canvasController.canvas.domElement;
				//This.canvasController.reshape($(canvas).width(),$(canvas).height());
			}
		}

		let timer = new paella.Timer(function(timer) {
			onUpdateSize();
		},500);
		timer.repeat = true;
	}

	defaultProfile() {
		return 'chroma';
	}

	_setVideoElem(video) {
		$(this.video).bind('progress', evtCallback);
		$(this.video).bind('loadstart',evtCallback);
		$(this.video).bind('loadedmetadata',evtCallback);
        $(this.video).bind('canplay',evtCallback);
		$(this.video).bind('oncanplay',evtCallback);
	}
	
	_deferredAction(action) {
		return new Promise((resolve,reject) => {
			if (this.video) {
				resolve(action());
			}
			else {
				$(this.video).bind('canplay',() => {
					this._ready = true;
					resolve(action());
				});
			}
		});
	}

	_getQualityObject(index, s) {
		return {
			index: index,
			res: s.res,
			src: s.src,
			toString:function() { return this.res.w + "x" + this.res.h; },
			shortLabel:function() { return this.res.h + "p"; },
			compare:function(q2) { return this.res.w*this.res.h - q2.res.w*q2.res.h; }
		};
	}

	// Initialization functions
	allowZoom() {
		return false;
	}
	
	getVideoData() {
		var This = this;
		return new Promise((resolve,reject) => {
			this._deferredAction(() => {
				resolve({
					duration: This.video.duration,
					currentTime: This.video.currentTime,
					volume: This.video.volume,
					paused: This.video.paused,
					ended: This.video.ended,
					res: {
						w: This.video.videoWidth,
						h: This.video.videoHeight
					}
				});
			});
		});
	}
	
	setPosterFrame(url) {
		this._posterFrame = url;
	}

	setAutoplay(auto) {
		this._autoplay = auto;
		if (auto && this.video) {
			this.video.setAttribute("autoplay",auto);
		}
	}

	load() {
		var This = this;
		return new Promise((resolve,reject) => {
			let sources = this._stream.sources[this._streamName];
			if (this._currentQuality===null && this._videoQualityStrategy) {
				this._currentQuality = this._videoQualityStrategy.getQualityIndex(sources);
			}

			let stream = this._currentQuality<sources.length ? sources[this._currentQuality]:null;
			paella.getVideoCanvas()
				.then((WebGLVideoCanvas) => {
					class MyWebGLVideoCanvas extends WebGLVideoCanvas {

						buildVideoSurface(sceneRoot,videoTexture) {
							let sphere = bg.scene.PrimitiveFactory.Sphere(this.gl,1,50);
							let sphereNode = new bg.scene.Node(this.gl);
							sphereNode.addComponent(sphere);
							sphere.getMaterial(0).texture = videoTexture;
							sphere.getMaterial(0).lightEmission = 0;
							sphere.getMaterial(0).lightEmissionMaskInvert = false;
							sphere.getMaterial(0).cullFace = false;
							sphereNode.addComponent(new bg.scene.Transform(bg.Matrix4.Scale(1,-1,1)));
							sceneRoot.addChild(sphereNode);
						}
						
						mouseWheel(evt) {
							console.log(evt);
							let proj = this.camera && this.camera.projectionStrategy;
							if (proj) {
								let minFocalLength = 30;
								let maxFocalLength = 200;
								proj.focalLength = proj.focalLength + evt.delta;
								if (proj.focalLength<minFocalLength) {
									proj.focalLength = minFocalLength;
								}
								else if (proj.focalLength>maxFocalLength) {
									proj.focalLength = maxFocalLength;
								}
								this.postRedisplay();
							}
						}
					};

					
					this.video = null;
					if (stream) {
						this.canvasController = null;

						let controller = new MyWebGLVideoCanvas(stream);
						let mainLoop = bg.app.MainLoop.singleton;

						mainLoop.updateMode = bg.app.FrameUpdate.AUTO;
						mainLoop.canvas = this.domElement;
						mainLoop.run(controller);

						return controller.loaded();
					}
					else {
						reject(new Error("Could not load video: invalid quality stream index"));
					}
				})

				.then((canvasController) => {
					this.canvasController = canvasController;

					this.video = canvasController.video;
					this.video.pause();
					this.disableEventCapture();
					resolve(stream);
				});
		});
	}

	getQualities() {
		return new Promise((resolve,reject) => {
			setTimeout(() => {
				var result = [];
				var sources = this._stream.sources[this._streamName];
				var index = -1;
				sources.forEach((s) => {
					index++;
					result.push(this._getQualityObject(index,s));
				});
				resolve(result);
			},10);
		});
	}

	setQuality(index) {
		return new Promise((resolve) => {
			var paused = this.video.paused;
			var sources = this._stream.sources[this._streamName];
			this._currentQuality = index<sources.length ? index:0;
			var currentTime = this.video.currentTime;
			this.freeze()

				.then(() => {
					this._ready = false;
					return this.load();
				})

				.then(() => {
					if (!paused) {
						this.play();
					}
					$(this.video).on('seeked',() => {
						this.unFreeze();
						resolve();
						$(this.video).off('seeked');
					});
					this.video.currentTime = currentTime;
				});
		});
	}

	getCurrentQuality() {
		return new Promise((resolve) => {	
			resolve(this._getQualityObject(this._currentQuality,this._stream.sources[this._streamName][this._currentQuality]));
		});
	}

	play() {
        return this._deferredAction(() => {
			bg.app.MainLoop.singleton.updateMode = bg.app.FrameUpdate.AUTO;
            this.video.play();
        });
	}

	pause() {
        return this._deferredAction(() => {
			bg.app.MainLoop.singleton.updateMode = bg.app.FrameUpdate.MANUAL;
            this.video.pause();
        });
	}

	isPaused() {
        return this._deferredAction(() => {
            return this.video.paused;
        });
	}

	duration() {
        return this._deferredAction(() => {
            return this.video.duration;
        });
	}

	setCurrentTime(time) {
        return this._deferredAction(() => {
            this.video.currentTime = time;
			$(this.video).on('seeked',() => {
				this.canvasController.postRedisplay();
				$(this.video).off('seeked');
			});
        });
	}

	currentTime() {
        return this._deferredAction(() => {
            return this.video.currentTime;
        });
	}

	setVolume(volume) {
        return this._deferredAction(() => {
            this.video.volume = volume;
        });
	}

	volume() {
		return this._deferredAction(() => {
            return this.video.volume;
        });
	}

	setPlaybackRate(rate) {
		return this._deferredAction(() => {
            this.video.playbackRate = rate;
        });
	}

	playbackRate() {
        return this._deferredAction(() => {
            return this.video.playbackRate;
        });
	}

	goFullScreen() {
		return this._deferredAction(() => {
			var elem = this.video;
			if (elem.requestFullscreen) {
				elem.requestFullscreen();
			}
			else if (elem.msRequestFullscreen) {
				elem.msRequestFullscreen();
			}
			else if (elem.mozRequestFullScreen) {
				elem.mozRequestFullScreen();
			}
			else if (elem.webkitEnterFullscreen) {
				elem.webkitEnterFullscreen();
			}
		});
	}

	unFreeze(){
		return this._deferredAction(() => {
			var c = document.getElementById(this.video.className + "canvas");
			$(c).remove();
		});
	}
	
	freeze(){
		var This = this;
		return this._deferredAction(function() {});
	}

	unload() {
		this._callUnloadEvent();
		return paella_DeferredNotImplemented();
	}

	getDimensions() {
		return paella_DeferredNotImplemented();
	}
}

paella.Video360 = Video360;

class Video360Factory extends paella.VideoFactory {
	isStreamCompatible(streamData) {
		try {
			if (paella.ChromaVideo._loaded) {
				return false;
			}
			if (paella.videoFactories.Html5VideoFactory.s_instances>0 && 
				base.userAgent.system.iOS)
			{
				return false;
			}
			for (var key in streamData.sources) {
				if (key=='video360') return true;
			}
		}
		catch (e) {}
		return false;
	}

	getVideoObject(id, streamData, rect) {
		paella.ChromaVideo._loaded = true;
		++paella.videoFactories.Html5VideoFactory.s_instances;
		return new paella.Video360(id, streamData, rect.x, rect.y, rect.w, rect.h);
	}
}

paella.videoFactories.Video360Factory = Video360Factory;

})();