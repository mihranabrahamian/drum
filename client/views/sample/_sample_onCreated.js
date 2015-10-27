Template._sample.onCreated(function() {
  var instance = this;

  instance.sample = function() {
    return Samples.findOne(instance.data.sampleId);
  };

  instance.sampleBufferLoaded = new ReactiveVar(false);

  instance.bufferNode = DrumApp.audioContext.createBufferSource();

  instance.schedulePlay = function(destination, time, velocity){
    instance.bufferNode = destination.context.createBufferSource();

    var fadeNode = destination.context.createGain();

    instance.bufferNode.disconnect();
    instance.bufferNode.buffer = instance.sampleBuffer;
    instance.bufferNode.connect(fadeNode);
    fadeNode.connect(instance.highPassFilter.input());
    
    
    fadeNode.gain.setValueCurveAtTime(
      instance.sample().fadeInCurve(),
      destination.context.currentTime,
      Math.max(0.001, instance.sample().fades.in.duration)
    );

    fadeNode.gain.setValueCurveAtTime(
      instance.sample().fadeOutCurve(),
      destination.context.currentTime+instance.sample().duration,
      Math.max(0.001, instance.sample().fades.out.duration)
    );

    instance.bufferNode.start(time);

  };

  var reactivelyControlFilters = function() {
    instance.HPF = new ReactiveDict();
    instance.LPF = new ReactiveDict();

    instance.autorun(function(){
      instance.HPF.set('frequency', instance.sample().highPassFilter.frequency);
      instance.HPF.set('slope', instance.sample().highPassFilter.slope);
      instance.LPF.set('frequency', instance.sample().lowPassFilter.frequency);
      instance.LPF.set('slope', instance.sample().lowPassFilter.slope);
    });

    instance.autorun(function(){
      instance.highPassFilter.setSlope(instance.HPF.get('slope'));
    });

    instance.autorun(function(){
      instance.highPassFilter.setFrequency(instance.HPF.get('frequency'));
    });

    instance.autorun(function(){
      instance.lowPassFilter.setSlope(instance.LPF.get('slope'));
    });

    instance.autorun(function(){
      instance.lowPassFilter.setFrequency(instance.LPF.get('frequency'));
    });
  };

  var initializeFilters = function() {
    instance.highPassFilter = new DrumApp.CustomFilter({context: DrumApp.audioContext, type: "highpass", bypassedFrequency: 0, frequency: instance.sample().highPassFilter.frequency, slope: instance.sample().highPassFilter.slope});
    instance.lowPassFilter = new DrumApp.CustomFilter({context: DrumApp.audioContext, type: "lowpass",  bypassedFrequency: 20000, frequency: instance.sample().lowPassFilter.frequency, slope: instance.sample().highPassFilter.slope});
    instance.highPassFilter.output().connect(instance.lowPassFilter.input());
    instance.lowPassFilter.output().connect(DrumApp.audioContext.destination);
  };

  instance.autorun(function() {
    //subscribe to this instance's Sample.
    instance.subscribe('sample', Template.currentData().sampleId, function() {

      initializeFilters();
      reactivelyControlFilters();

      //once subscribed to sample, subscribe to its sound.
      instance.subscribe('sound', instance.sample().soundId, function() {
        //store the sound's audioBuffer promise in this instance.
        instance.soundPromise = instance.sample().sound().requestTape();

        instance.autorun(function() {
          //when sample data changes, update this instance's samplePromise
          instance.sample();
          instance.sampleBufferLoaded.set(false);

          //slice out the sample and store its audioBuffer in this instance.
          instance.soundPromise.then(function(tape){
            instance.samplePromise = tape.slice(instance.sample().startTime - instance.sample().fades.in.duration, instance.sample().duration + instance.sample().fades.out.duration).render();
            
            instance.samplePromise.then(function(buffer) {
              instance.sampleBuffer = buffer;
              instance.sampleBufferLoaded.set(true);
            });
          });

        });

      });
    });
  });

});