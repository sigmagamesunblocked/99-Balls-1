let game;
let gameOptions = {
    ballSize: 0.04,
    ballSpeed: 1000,
    blocksPerLine: 7,
    blockLines: 8,
    maxBlocksPerLine: 4,
    extraBallProbability: 60
}
window.onload = function() {
    let gameConfig = {
        type: Phaser.AUTO,
        backgroundColor:0x420303,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: "thegame",
            width: 640,
            height: 960
        },
        physics: {
            default: "arcade"
        },
        scene: playGame
    }
    game = new Phaser.Game(gameConfig);
    window.focus();
}

const WAITING_FOR_PLAYER_INPUT = 0;
const PLAYER_IS_AIMING = 1;
const BALLS_ARE_RUNNING = 2;
const ARCADE_PHYSICS_IS_UPDATING = 3;
const PREPARING_FOR_NEXT_MOVE = 4;

class playGame extends Phaser.Scene {
    constructor() {
        super("PlayGame");
		this.score = 0;
    }
    preload() {
        this.load.image("ball", "ball.png");
        this.load.image("panel", "panel.png");
        this.load.image("trajectory", "trajectory.png");
        this.load.image("block", "block.png");
    }
    create() {
        this.gameState = WAITING_FOR_PLAYER_INPUT;
        this.gameOver = false;
        this.level = 0;
        this.recycledBlocks = [];
        this.blockSize = game.config.width / gameOptions.blocksPerLine;
        this.gameFieldHeight = this.blockSize * gameOptions.blockLines;
        this.emptySpace = game.config.height - this.gameFieldHeight;
        this.physics.world.setBounds(0, this.emptySpace / 2, game.config.width, this.gameFieldHeight);
        this.blockGroup = this.physics.add.group();
        this.ballGroup = this.physics.add.group();
        this.extraBallGroup = this.physics.add.group();
        let scorePanel = this.add.sprite(game.config.width / 2, 0, "panel");
        scorePanel.displayWidth = game.config.width;
        scorePanel.displayHeight = this.emptySpace / 2;
        scorePanel.setOrigin(0.5, 0);
        this.bottomPanel = this.add.sprite(game.config.width / 2, game.config.height, "panel");
        this.bottomPanel.displayWidth = game.config.width;
        this.bottomPanel.displayHeight = this.emptySpace / 2;
        this.bottomPanel.setOrigin(0.5, 1);
        this.ballSize = game.config.width * gameOptions.ballSize;
        this.addBall(game.config.width / 2, game.config.height - this.bottomPanel.displayHeight - this.ballSize / 2, false);
        this.addTrajectory();
        this.addBlockLine();
        this.input.on("pointerdown", this.startAiming, this);
        this.input.on("pointerup", this.shootBall, this);
        this.input.on("pointermove", this.adjustAim, this);
        this.physics.world.on("worldbounds", this.checkBoundCollision, this);
		this.pauseButton = this.add.text(20, 20, 'Pause', { fill: '#ffffff', fontSize: '40px' }).setInteractive();
        this.pauseButton.on('pointerdown', this.togglePause, this);

        // Display the score
        this.scoreText = this.add.text(game.config.width - 240, 20, 'Score: 0', { fill: '#ffffff', fontSize: '40px' });

        // Flag to track if the game is paused
        this.isPaused = false;
    }
	updateScore() {
        this.score++;
        this.scoreText.setText('Score: ' + this.score);
    }
	
	 togglePause() {
        this.isPaused = !this.isPaused; // Toggle the pause state

        if (this.isPaused) {
            this.pauseButton.setText('Play');
            this.scene.pause(this); // Pass the scene reference to pause method
        } else {
            this.pauseButton.setText('Pause');
            this.scene.resume(this); // Pass the scene reference to resume method
        }
    }


    addBall(x, y, isExtraBall) {
        let ball = isExtraBall ? this.extraBallGroup.create(x, y, "ball") : this.ballGroup.create(x, y, "ball");
        ball.displayWidth = this.ballSize;
        ball.displayHeight = this.ballSize;
        ball.body.setBounce(1, 1);
        if(isExtraBall) {
            ball.row = 1;
            ball.collected = false;
        } else {
            ball.body.collideWorldBounds = true;
            ball.body.onWorldBounds = true;
        }
    }

    addBlockLine() {
        this.level ++;
        let placedBlocks = [];
        let placeExtraBall = Phaser.Math.Between(0, 100) < gameOptions.extraBallProbability;
        for(let i = 0; i < gameOptions.maxBlocksPerLine; i ++) {
            let blockPosition =  Phaser.Math.Between(0, gameOptions.blocksPerLine - 1);
            if(placedBlocks.indexOf(blockPosition) == -1) {
                placedBlocks.push(blockPosition);
                if(placeExtraBall) {
                    placeExtraBall = false;
                    this.addBall(blockPosition * this.blockSize + this.blockSize / 2, this.blockSize / 2 + this.emptySpace / 2, true);
                } else {
                    if(this.recycledBlocks.length == 0) {
                        this.addBlock(blockPosition * this.blockSize + this.blockSize / 2, this.blockSize / 2 + this.emptySpace / 2, false);
                    } else {
                        this.addBlock(blockPosition * this.blockSize + this.blockSize / 2, this.blockSize / 2 + this.emptySpace / 2, true)
                    }
                }
            }
        }
    }

    addBlock(x, y, isRecycled) {
        let block = isRecycled ? this.recycledBlocks.shift() : this.blockGroup.create(x, y, "block");
        block.displayWidth = this.blockSize;
        block.displayHeight = this.blockSize;
        block.value = this.level;
        block.row = 1;
        if(isRecycled) {
            block.x = x;
            block.y = y;
            block.text.setText(block.value);
            block.text.x = block.x;
            block.text.y = block.y;
            block.setVisible(true);
            block.text.setVisible(true);
            this.blockGroup.add(block);
        } else {
            let text = this.add.text(block.x, block.y, block.value, {
                font: "bold 32px Arial",
                align: "center",
                color: "#000000"
            });
            text.setOrigin(0.5);
            block.text = text;
        }
        block.body.immovable = true;
    }

    getBallPosition() {
        let children = this.ballGroup.getChildren();
        return {
            x: children[0].x,
            y: children[0].y
        }
    }

    addTrajectory() {
        let ballPosition = this.getBallPosition();
        this.trajectory = this.add.sprite(ballPosition.x, ballPosition.y, "trajectory");
        this.trajectory.setOrigin(0.5, 1);
        this.trajectory.setVisible(false);
    }

    startAiming() {
        if(this.gameState == WAITING_FOR_PLAYER_INPUT) {
            this.legalAngleOfFire = false;
            this.gameState = PLAYER_IS_AIMING;
            this.trajectory.x = this.getBallPosition().x;
            this.trajectory.y = this.getBallPosition().y;
        }
    }

    adjustAim(e) {
        if(this.gameState == PLAYER_IS_AIMING) {
            let distX = e.x - e.downX;
            let distY = e.y - e.downY;
            if(distY > 10) {
                this.legalAngleOfFire = true;
                this.trajectory.setVisible(true);
                this.direction = Phaser.Math.Angle.Between(e.x, e.y, e.downX, e.downY);
                this.trajectory.angle = Phaser.Math.RadToDeg(this.direction) + 90;
            } else {
                this.legalAngleOfFire = false;
                this.trajectory.setVisible(false);
            }
        }
    }

    shootBall() {
        if(this.gameState == PLAYER_IS_AIMING) {
            this.trajectory.setVisible(false);
            if(this.legalAngleOfFire) {
                this.gameState = BALLS_ARE_RUNNING;
                this.landedBalls = 0;
                let angleOfFire = Phaser.Math.DegToRad(this.trajectory.angle - 90);
                this.ballGroup.getChildren().forEach(function(ball, index) {
                    this.time.addEvent({
                        delay: 100 * index,
                        callback: function() {
                            ball.body.setVelocity(gameOptions.ballSpeed * Math.cos(angleOfFire), gameOptions.ballSpeed * Math.sin(angleOfFire));
                        }
                    });
                }.bind(this))
            } else {
                this.gameState = WAITING_FOR_PLAYER_INPUT;
            }
        }
    }

    checkBoundCollision(ball, up, down, left, right) {
        if(down && this.gameState == BALLS_ARE_RUNNING) {
            ball.setVelocity(0);
            this.landedBalls ++;
            if(this.landedBalls == 1) {
                this.firstBallToLand = ball;
            }
        }
    }

    update() {
        if((this.gameState == ARCADE_PHYSICS_IS_UPDATING) || this.gameState == BALLS_ARE_RUNNING && this.landedBalls == this.ballGroup.getChildren().length) {
            if(this.gameState == BALLS_ARE_RUNNING) {
                this.gameState = ARCADE_PHYSICS_IS_UPDATING;
            } else{
                this.gameState = PREPARING_FOR_NEXT_MOVE;
                this.moveBlocks();
                this.moveBalls();
                this.moveExtraBalls();
            }
        }
        if(this.gameState == BALLS_ARE_RUNNING) {
            this.handleBallVsBlock();
            this.handleBallVsExtra();
        }
    }

    moveBlocks() {
        this.tweens.add({
            targets: this.blockGroup.getChildren(),
            props: {
                y: {
                    getEnd: function(target) {
                        return target.y + target.displayHeight;
                    }
                },
            },
            callbackScope: this,
            onUpdate: function(tween, target) {
                target.text.y = target.y;
            },
            onComplete: function() {
                this.gameState = WAITING_FOR_PLAYER_INPUT;
                Phaser.Actions.Call(this.blockGroup.getChildren(), function(block) {
                    block.row ++;
                    if(block.row == gameOptions.blockLines) {
                        this.gameOver = true;
                    }
                }, this);
                if(!this.gameOver) {
                    this.addBlockLine();
                } else {
                    this.scene.start("PlayGame");
                }
            },
            duration: 500,
            ease: "Cubic.easeInOut"
        });
    }

    moveBalls() {
        this.tweens.add({
            targets: this.ballGroup.getChildren(),
            x: this.firstBallToLand.gameObject.x,
            duration: 500,
            ease: "Cubic.easeInOut"
        });
    }

    moveExtraBalls() {
        Phaser.Actions.Call(this.extraBallGroup.getChildren(), function(ball) {
            if(ball.row == gameOptions.blockLines) {
                ball.collected = true;
            }
        })
        this.tweens.add({
            targets: this.extraBallGroup.getChildren(),
            props: {
                x: {
                    getEnd: function(target) {
                        if(target.collected) {
                            return target.scene.firstBallToLand.gameObject.x;
                        }
                        return target.x;
                    }
                },
                y: {
                    getEnd: function(target) {
                        if(target.collected) {
                            return target.scene.firstBallToLand.gameObject.y;
                        }
                        return target.y + target.scene.blockSize;
                    }
                },
            },
            callbackScope: this,
            onComplete: function() {
                Phaser.Actions.Call(this.extraBallGroup.getChildren(), function(ball) {
                    if(!ball.collected) {
                        ball.row ++;
                    } else {
                        this.extraBallGroup.remove(ball);
                        this.ballGroup.add(ball);
                        ball.body.collideWorldBounds = true;
                        ball.body.onWorldBounds = true;
                        ball.body.setBounce(1, 1);
                    }
                }, this);
            },
            duration: 500,
            ease: "Cubic.easeInOut"
        });
    }

    handleBallVsBlock() {
        this.physics.world.collide(this.ballGroup, this.blockGroup, function(ball, block) {
            block.value--;
            if (block.value == 0) {
                this.recycledBlocks.push(block);
                this.blockGroup.remove(block);
                block.visible = false;
                block.text.visible = false;
                this.updateScore(); // Update score when a block is broken
            } else {
                block.text.setText(block.value);
            }
        }, null, this);
    }
    handleBallVsExtra() {
        this.physics.world.overlap(this.ballGroup, this.extraBallGroup, function(ball, extraBall) {
            extraBall.collected = true;
            this.tweens.add({
                targets: extraBall,
                y: game.config.height - this.bottomPanel.displayHeight - extraBall.displayHeight / 2,
                duration: 200,
                ease: "Cubic.easeOut"
            });
        }, null, this);
    }
}
