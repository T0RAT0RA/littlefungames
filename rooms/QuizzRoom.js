const _ = require('lodash');
const fs = require('fs');
const randomstring = require('randomstring');
const Room = require('colyseus').Room;
const Clock = require('colyseus').Clock;
const StateMachine = require('javascript-state-machine');

const COLORS = [
  '#FF0000',
  '#D600FF',
  '#0000FF',
  '#FFFF00',
  '#11DDED',
  '#EC636A',
  '#2D723C',
  '#FDCF89',
  '#777887',
  '#3C3431',
];

const SOUNDS = [];
fs.readdirSync('./assets/player').forEach(file => {
  SOUNDS.push(file);
});

const QUESTIONS = require('./questions.fr.json');

//Times in seconds
const LOBBY_TIME = 5;
const QUESTION_TIME = 40;
const VOTE_TIME = 30;
const ANSWER_TIME = 60000;
const MAX_QUESTIONS = 5;
const MAX_PLAYERS = 10;

module.exports = class QuizzRoom extends Room {
  onInit (options) {
    this.code = null;
    this.maxClients = MAX_PLAYERS + 1; //+1 screen
    this.availableColors = _.shuffle(COLORS);
    this.availableSounds = _.shuffle(SOUNDS);

    //This is the state sent to connected clients.
    this.setState({
      code: this.code,
      gameTimer: LOBBY_TIME,
      gameTimerMax: null,
      gameStarted: null,
      gamePaused: false,
      gamePausedMessage: '',
      screens: {},
      players: {},
      answers: null,
      results: {},
      playerVotes: {},
      state: null,
      questionsAsked: 0,
      maxQuestions: MAX_QUESTIONS,
      logs: []
    });

    this.fsm = new StateMachine({
      init: 'lobby',
      transitions: [
        { name: 'start',    from: 'lobby',    to: 'question'  },
        { name: 'vote',     from: 'question', to: 'vote'      },
        { name: 'results',  from: 'vote',     to: 'results'   },
        { name: 'ask',      from: 'results',  to: () => {
            return this.questionsAsked.length < this.questions.length ? 'question' : 'end';
          }},
        { name: 'end',      from: 'answer',   to: 'results'   },
        { name: 'newGame',  from: 'end',      to: 'lobby'     },
      ],
      methods: {
        onBeforeTransition: this.onBeforeTransition.bind(this),
        onEnterState: this.onEnterState.bind(this),
        onEnterQuestion: this.onEnterQuestion.bind(this),
        onEnterVote: this.onEnterVote.bind(this),
        onEnterResults: this.onEnterResults.bind(this),
        onEnterEnd: this.onEnterEnd.bind(this),
        onEnterLobby: this.onEnterLobby.bind(this),
      }
    });

    console.log(`Quizzroom ${this.code} - created.`, options);
  }

  onEnterLobby() {
    this.questions = _.sampleSize(QUESTIONS, this.state.maxQuestions);
    this.state.questionsAsked = 0;
    this.questionsAsked = [];

    this.timer = {
      start: null,
    };

    this.state.gameTimer = LOBBY_TIME;
    this.state.gameTimerMax = LOBBY_TIME;
    this.state.gameStarted = false;
    this.state.state = 'lobby';
  }

  requestJoin (options, isNew) {
    if (options.code) {
      console.log('code = ', this.code, '==', options.code);
      if (this.code === null) {
        throw new Error('join_request_fail_room_unknown');
      }

      // If a client tries to join a started game and is not part of the game, disconnect him
      if (this.state.gameStarted && this.state.state !== 'lobby'
          && !this.state.players[options.clientId]
          && !this.state.screens[options.clientId]
        ) {
        throw new Error('join_request_fail_game_in_progress');
        return false;
      }

      return options.code.toUpperCase() == this.code.toUpperCase();
    }

    if(!options.code) {
      console.log('no code - isNew = ', isNew);
      return isNew;
    }

    console.log('return false');
    return false;
  }

  onJoin (client, options) {
    if (!this.code) {
      this.code = process.env.ROOM_CODE || randomstring.generate({length: 6, readable: true, capitalization: 'uppercase'});
      this.state.code = this.code;
    }
    if (options.screen) {
      console.log(`Quizzroom ${this.code} - screen ${client.id} joined.`);
      this.state.logs.push(`Screen ${client.id} joined.`);
      this.state.screens[client.id] = {
        id: client.id,
      };
    } else {
      let username = options.name;
      if (!options.name) {
        username = `Player ${_.keys(this.state.players).length + 1}`;
      }

      console.log(`Quizzroom ${this.code} - player ${client.id} ${username} joined.`);
      this.state.logs.push(`Player ${client.id} ${username} joined.`);
      if (this.state.players[client.id]) {
        this.state.players[client.id].disconnected = false;
        //If all players are connected, resume the game
        if (!this.disconnectedPlayers().length) {
          if (this.state.state !== 'lobby') {
            this.lock();
          }
          this.resumeGame();
        }
      } else {
        this.state.players[client.id] = {
          id: client.id,
          name: username,
          color: this.availableColors.pop(),
          sound: this.availableSounds.pop(),
          score: 0,
          ready: null,
          disconnected: null,
        };
      }

      this.pauseLobby();

    }
  }

  onLeave (client) {
    if (this.state.players[client.id]) {
      console.log(`Quizzroom ${this.code} - client ${client.id} left.`);
      this.state.players[client.id].disconnected = true;
      this.pauseGame('A player has been lost! The game will resume once they\'re back.');
      this.unlock();
    } else if (this.state.screens[client.id]) {
      console.log(`Quizzroom ${this.code} - screen ${client.id} left.`);
      delete this.state.screens[client.id];
      this.state.logs.push(`Screen ${client.id} left.`);
    }
  }

  updateGameTimer(callback) {
    if (this.state.gamePaused) {
      return;
    }

    this.state.gameTimer--;

    if (this.state.gameTimer <= 0) {
      this.timer.start.clear();
      callback.call(this);
    }
  }

  getNextQuestion() {
    return this.questions[this.questionsAsked.length];
  }

  getLastQuestion() {
    return _.last(this.questionsAsked);
  }

  onEnterQuestion () {
    this.state.gameTimer = QUESTION_TIME;
    this.state.gameTimerMax = QUESTION_TIME;
    this.state.questionsAsked++;
    const question = this.getNextQuestion();
    this.questionsAsked.push(question);
    this.state.question = {...question};
    this.state.question.answer = null;

    const callback = () => {
      this.fsm.vote();
    };
    this.timer.start = this.clock.setInterval(this.updateGameTimer.bind(this, callback), 1000);
  }

  onEnterVote () {
    this.state.gameTimer = VOTE_TIME;
    this.state.gameTimerMax = VOTE_TIME;

    const playerAnswers = _.reduce(this.state.players, (o, p) => {
                                    if(p.answer) {
                                      o.push(p.answer);
                                    }
                                    return o;
                                  }, []);


    let allAnswers = _.uniq([
      ...playerAnswers,
      this.getLastQuestion().answer.toUpperCase()
    ]);
    //If not enough answers, we're gonna add traps
    const missingAnswers = _.keys(this.state.players).length - (allAnswers.length - 1);
    allAnswers = [
      ...allAnswers,
      ..._.sampleSize(
        this.getLastQuestion().traps || [],
        missingAnswers
      )];
    this.state.answersChoice = _.shuffle(allAnswers).map(item => item.toUpperCase());

    const callback = () => {
      this.fsm.results();
    };
    this.timer.start = this.clock.setInterval(this.updateGameTimer.bind(this, callback), 1000);
  }

  onEnterResults () {
    const SCORE_CORRECT = 1000;
    const SCORE_FOOL = 500;
    const SCORE_TRAP = -200;


    this.state.gameTimer = ANSWER_TIME;
    this.state.gameTimerMax = ANSWER_TIME;
    this.state.question = {...this.getLastQuestion()};
    this.state.results = {};

    const correctAnswer = this.state.question.answer.toUpperCase();
    const data = _.reduce(this.state.players, (o, p) => {

      if(p.answer) {
        if(!o.answers[p.answer]) {
          o.answers[p.answer] = [];
        }
        o.answers[p.answer].push(p);
      }

      if(p.vote) {
        if(!o.votes[p.vote]) {
          o.votes[p.vote] = [];
        }
        o.votes[p.vote].push(p);
      }

      return o;
    }, {votes: {}, answers: {}});


    const playerVotes = data.votes;
    const playerAnswers = data.answers;

    for (let vote in playerVotes) {
      let players = playerVotes[vote];
      let type = null;

      if (vote === correctAnswer) {
        type = 'correct';
      } else if (playerAnswers[vote]) {
        type = 'fool';
      } else {
        type = 'trap';
      }

      this.state.results[vote] = {
        vote,
        type,
        players: {},
        foolers: {},
      };

      for (let p of players) {
        let player = this.state.players[p.id];
        let points = 0;

        if (type === 'correct') {
          points = SCORE_CORRECT;

          player.score += points;
          this.state.results[vote].players[player.name] = {
            name: player.name,
            points: points,
          };
        }

        if (type === 'trap') {
          points = SCORE_TRAP;

          player.score += points;
          this.state.results[vote].players[player.name] = {
            name: player.name,
            points: points,
          };
        }

        if (type === 'fool') {
          let playersAnswer = playerAnswers[vote];
          if (playersAnswer) {
            points = SCORE_FOOL;
            this.state.results[vote].players[player.name] = {
              name: player.name
            };

            for (let a of playersAnswer) {
              let fooler = this.state.players[a.id];
              if (fooler.id === player.id) {
                //You can't fool yourself
                continue;
              }
              fooler.score += points;
              this.state.results[vote].foolers[fooler.name] = {
                name: fooler.name,
                points: points,
              };
            }
          }
        }
      }
    }

    //Add the correct answer, if no one voted for it
    if (!this.state.results[correctAnswer]) {
      this.state.results[correctAnswer] = {
        vote: correctAnswer,
        type: 'correct',
        players: [],
        foolers: [],
      };
    }

    //Sort correct answer at the end
    this.state.results = _.sortBy(this.state.results, (o) => o.type == 'correct')

    //Reset players vote and answer
    this.state.players = _.mapValues(this.state.players, (p) => {
      p.answer = null;
      p.vote = null;
      return p;
    });

    const callback = () => {
      this.fsm.ask();
    };
    this.timer.start = this.clock.setInterval(this.updateGameTimer.bind(this, callback), 1000);
  }

  onEnterEnd () {
    this.state.gameStarted = false;
  }

  onBeforeTransition (lifecycle) {
    return true;
  }

  /**
   * Update server state to notify clients of the new state.
   * @param lifecycle
   */
  onEnterState (lifecycle) {
    if (!this.state) {
      return;
    }

    this.state.state = lifecycle.fsm.state;
    this.unreadyPlayers();
  }

  pauseGame (message = '') {
    this.state.gamePaused = true;
    this.state.gamePausedMessage = message;
  }

  resumeGame () {
    this.state.gamePaused = false;
    this.state.gamePausedMessage = '';
  }

  onMessage (client, data) {
    this.state.logs.push(`(${ client.id }) ${ JSON.stringify(data) }`);

    if (data.startGame) {
      if (!this.timer.start) {
        const callback = () => {
          this.lock();
          this.fsm.start();
        };
        this.timer.start = this.clock.setInterval(this.updateGameTimer.bind(this, callback), 1000)
        this.state.gameStarted = true;
      }

      this.markPlayerIsReady(client.id, false);
    }

    if (data.pauseGame) {
      this.pauseLobby();
    }

    if (data.answer) {
      this.onPlayerAnswer(client, data);
    }

    if (data.resumeGame) {
      this.onPlayerAnswer(client, data);
    }

    if (data.vote || data.vote === null) {
      this.onPlayerVote(client, data);
    }

    if (data.startNewGame) {
      this.fsm.newGame();
      this.markPlayerIsReady(client.id);
    }

    if (data.newName) {
      if(!this.state.gameStarted) {
        this.state.players[client.id].name = data.newName;
      }
    }

    //FOR DEBUGGING PURPOSES
    if (data.next) {
      this.state.gameTimer = 0;
    }

  }

  onPlayerAnswer (client, data) {
    const answer = data.answer.toUpperCase();
    const player = this.state.players[client.id];

    player.answer = answer;

    this.markPlayerIsReady(player.id);

  }

  onPlayerVote (client, data) {
    const vote = data.vote;
    const player = this.state.players[client.id];

    player.vote = vote;

    if (!player.vote) {
      this.markPlayerNotReady(player.id);
    } else {
      this.markPlayerIsReady(player.id);
    }

  }

  onDispose () {
    console.log(`Quizzroom ${this.code} - deleted.`);
  }

  markPlayerIsReady (playerId, allPlayerReadyTimer = true) {
    if (!this.state.players[playerId]) {
      return;
    }
    this.state.players[playerId].ready = true;
    //If all players are ready, skip to next step.
    if(allPlayerReadyTimer && this.areAllPlayersReady()) {
      this.state.gameTimer = 0;
    }
  }

  markPlayerNotReady (playerId) {
    if (!this.state.players[playerId]) {
      return;
    }
    this.state.players[playerId].ready = false;
  }

  areAllPlayersReady () {
    return _.filter(this.state.players, function(p) { return !p.ready; }).length === 0;
  }

  disconnectedPlayers () {
    return _.filter(this.state.players, 'disconnected');
  }

  unreadyPlayers () {
    this.state.players = _.mapValues(this.state.players, (p) => { return {...p, ready: false}; });
  }

  pauseLobby () {
    if (!this.timer.start || this.state.state !== 'lobby') {
      return;
    }

    this.timer.start.clear();
    this.timer.start = null;
    this.state.gameTimer = LOBBY_TIME;
    this.state.gameStarted = false;
    this.unreadyPlayers();
  }
};
