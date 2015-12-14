define( function( require ) {
  'use strict';

  // modules
  var inherit = require( 'PHET_CORE/inherit' );
  var PropertySet = require( 'AXON/PropertySet' );
  var Snake = require( 'CUPCAKE_SNAKE/model/Snake' );
  var Vector2 = require( 'DOT/Vector2' );
  var ObservableArray = require( 'AXON/ObservableArray' );
  var Intersection = require( 'CUPCAKE_SNAKE/model/Intersection' );
  var Emitter = require( 'AXON/Emitter' );

  var Sound = require( 'VIBE/Sound' );

  // audio
  var chomp = require( 'audio!CUPCAKE_SNAKE/chomp' );
  var chompSound = new Sound( chomp );

  var INITIAL_SNAKE_LENGTH = 150;
  var INITIAL_SNAKE_RADIUS = 30;

  function CupcakeSnakeModel() {
    var self = this;
    this.deathEmitter = new Emitter();

    PropertySet.call( this, {
      left: false,
      right: false,
      everTurned: false,
      remainingLengthToGrow: 0,
      motion: Snake.STRAIGHT,
      currentLevel: null, // Level
      alive: true,
      level: 0 // {number} 0 is home screen, 1 is level 1
    } );
    window.model = this;

    this.snake = new Snake( new Vector2( 0, 0 ), new Vector2( 0, -1 ), INITIAL_SNAKE_LENGTH, INITIAL_SNAKE_RADIUS );

    this.visibleLevels = new ObservableArray(); // .<Level>

    this.multilink( [ 'left', 'right' ], function() {
      self.motion = ( self.left === self.right ) ? Snake.STRAIGHT : ( self.left ? Snake.LEFT : Snake.RIGHT );
      self.everTurned = self.everTurned || self.left || self.right;
    } );

    this.running = false;
  }

  return inherit( PropertySet, CupcakeSnakeModel, {
    step: function( dt ) {
      if ( dt > 0.5 ) {
        dt = 0.5;
      }

      var cupcakeSnakeModel = this;

      if ( this.running && this.alive ) {
        var growLength = 150 * dt;
        var shrinkLength = Math.max( growLength - this.remainingLengthToGrow, 0 );
        this.snake.step( growLength, shrinkLength, this.motion );
        this.remainingLengthToGrow = Math.max( this.remainingLengthToGrow - growLength, 0 );

        // Button intersection
        this.currentLevel.bluePressed = this.snake.intersectsSegments( this.currentLevel.blueButton.segments );
        this.currentLevel.yellowPressed = this.snake.intersectsSegments( this.currentLevel.yellowButton.segments );

        // Door intersection
        if ( Intersection.intersect( this.snake.currentSegment.segment, this.currentLevel.door.segment ) ) {
          this.currentLevel.active = false;
          var level = this.currentLevel.nextLevel.copy();
          level.previousLevel = this.currentLevel; // hook for later
          this.visibleLevels.push( level );
          this.currentLevel = level;
        }

        var cupcakeArray = this.currentLevel.cupcakes.getArray();
        var toRemove = [];
        for ( var i = 0; i < cupcakeArray.length; i++ ) {
          var cupcake = cupcakeArray[ i ];
          var dx = cupcake.x - this.snake.position.x;
          var dy = cupcake.y - this.snake.position.y;

          var distance = Math.sqrt( dx * dx + dy * dy );
          if ( distance < 30 ) {
            toRemove.push( cupcake );
            this.remainingLengthToGrow += 100;
          }
        }
        this.currentLevel.cupcakes.removeAll( toRemove );
        if ( toRemove.length > 0 ) {
          chompSound.play();
        }

        var hitObstable = false;
        var hitMessage = null;

        // Check if the snake hit a wall
        for ( var k = 0; k < this.currentLevel.walls.length && !hitObstable; k++ ) {
          var wall = this.currentLevel.walls[ k ];

          var hit = this.snake.intersectsSegments( wall.segments, true );
          if ( hit ) {
            hitObstable = true;
            hitMessage = 'Bumping into a wall didn\'t seem that dangerous!';
            break;
          }
        }

        var previousLevel = this.currentLevel.previousLevel;
        if ( previousLevel ) {
          // hit-test against the closed door (if we passed it)
          var headOverDoor = Intersection.intersect( this.snake.currentSegment.segment, previousLevel.door.segment );
          if ( headOverDoor ) {
            if ( previousLevel.headOut ) {
              hitMessage = 'My mother always said to not dwell in the past.';
              hitObstable = true;
            }
          }
          else {
            previousLevel.headOut = true;
          }

          // see if we can make the previous level invisible
          if ( this.visibleLevels.contains( previousLevel ) ) {
            var bodyOverDoor = this.snake.intersectsSegments( [ previousLevel.door.segment ] );

            if ( !bodyOverDoor ) {
              previousLevel.snakeFullyOut = true;
              this.visibleLevels.remove( previousLevel );
            }
          }
        }

        // Check if the snake hit the doors
        if ( ( !this.currentLevel.bluePressed && this.snake.intersectsSegments( this.currentLevel.door.blueSegments, false ) ) ||
             ( !this.currentLevel.yellowPressed && this.snake.intersectsSegments( this.currentLevel.door.yellowSegments, false ) ) ) {
          hitObstable = true;
          hitMessage = 'Looks like there\'s no open-door policy here.';
        }

        if ( hitObstable ) {
          if ( !this.everTurned ) {
            hitMessage = 'Try the left/right arrow keys or the on-screen buttons';
          }

          // snake died (perhaps in the future)
          this.deathEmitter.emit1( hitMessage );
          this.alive = false;
        }
      }
    },

    startLevel: function( level ) {
      level = level.copy();

      this.visibleLevels.clear();
      this.visibleLevels.push( level );
      this.currentLevel = level;

      this.snake.reinitialize( level.startPosition.copy(), new Vector2( 0, -1 ), INITIAL_SNAKE_LENGTH, INITIAL_SNAKE_RADIUS );
    }
  } );
} );