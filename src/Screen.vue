<template>
  <div class="screen">
    <div v-if="!isConnected">
      
      <button type="button" class="btn btn-primary btn-lg"
              @click="createGame()">
        {{ $t('New Game') }}
      </button>
      <br>{{ $t('or') }}<br>
      {{ $t('Join a game:') }} <input v-model="roomCode" :placeholder="$t('Code')"
                          size="8" maxlength="6" autofocus />
      <button type="button" class="btn btn-secondary btn-lg"
              @click="join('quizz', {screen: true})">
        {{ $t('Join') }}
      </button>
      
      <p class="text-danger" v-if="serverError">
        {{ serverError }}
      </p>
      
    </div>
    
    <div v-else style="margin-top: 15px;">
      <div class="row">
        <div class="players col-sm-3">
          <div class="card">
            <div class="card-header">
              <template v-if="!playersByScore">
                No player yet.
              </template>
              <template v-else>
                {{ playersByScore.length }} {{ $t('Players:') }}
              </template>
            </div>
            <ul class="list-group list-group-flush">
              <li v-if="players"
                  v-for="player in players"
                  class="list-group-item d-flex justify-content-between align-items-center"
                  :class="{
                    'list-group-item-warning': player.disconnected
                  }">
                <span>
                  <span class="player-color"
                    :style="{ backgroundColor: player.color }"
                  ></span>
                  {{ player.name }}
                </span>
                <span>
                  <i class="fas fa-check" v-if="player.ready"></i>
                  <template v-if="player.disconnected">
                    <i class="fas fa-exclamation-triangle"></i>
                  </template>
                  <span class="badge badge-primary"
                        v-if="gameState !== 'lobby' && gameState !== 'results'">
                    {{ player.score }}
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>
        
        <div class="col-sm-9">
          <div class="alert alert-warning" role="alert" v-if="serverState.gamePaused">
            {{ $t('Game is paused.') }}<br>
            {{ $t(serverState.gamePausedMessage) }}
          </div>
          
          <div class="card">
            <div class="card-header" style="padding: 5px 20px;">
              <div class="float-left">
                {{ $t('Questions:') }} {{ `${serverState.questionsAsked}/${serverState.maxQuestions}` }}
              </div>
              <div class="float-right">{{ $t('Room code:') }} <b>{{ serverState.code }}</b></div>
            </div>
            <div class="card-body">
              <div v-if="gameState === 'lobby'">
                <p class="card-text">
                  {{ $t('Click start on your device to start the game.') }}<br>
                  <template v-if="qrCode">
                    {{ $t('Scan this image to join the game:') }}<br>
                    <img :src="qrCode"/><br>
                  </template>
                  {{ $t('Or go to:') }} <a :href="gameURL" target="_blank">{{ gameURL }}</a><br>
                </p>
              </div>
              
              <div class="state-question" v-else-if="gameState === 'question'">
                {{ serverState.question.text }}
              </div>
              <div class="state-vote" v-else-if="gameState === 'vote'">
                {{ serverState.question.text }}<br>
                {{ $t('Choose one of these answer:') }}<br>
                <div class="badge badge-primary"
                      v-for="answer in serverState.answersChoice">{{ answer}}</div>
              </div>
              
              <div v-else-if="gameState === 'results'">
                <transition
                  appear
                  v-on:before-enter="beforeEnter"
                  v-on:enter="enter"
                  v-on:leave="leave"
                  v-bind:css="false"
                >
                  <div class="result">
                    <div v-for="result in serverState.results"
                         class="vote"
                         :class="{
                           correct: result.type == 'correct',
                           fool: result.type == 'fool',
                           trap: result.type == 'trap',
                         }"
                    >
                      <div class="label badge badge-primary">
                        <span>{{result.vote}}</span>
                        <span class="result" style="display: none;">
                          <template v-if="result.type === 'correct'">
                            BONNE RÉPONSE!<br>
                            
                            <span v-if="Object.keys(result.players).length <= 0">
                              mais personne n'a trouvé...
                            </span>
                          </template>
                          <template v-if="result.type === 'trap'">C'ÉTAIT UN PIÈGE!</template>
                          <template v-if="result.type === 'fool'">
                            <span v-for="player in result.foolers"
                                 class="fooler badge badge-info"
                                :style="playerColorStyle(player)"
                            >
                              {{player.name}}
                              <span v-if="player.points" class="points badge badge-dark">
                                <template v-if="player.points > 0">+</template>{{player.points}}
                              </span>
                            </span><br>
                            <span v-if="Object.keys(result.foolers).length === 1">
                              vous a eu!
                            </span>
                            <span v-if="Object.keys(result.foolers).length > 1">
                              vous ont eu!
                            </span>
                          </template>
                        </span>
                      </div>
                      <div class="players">
                        <template v-for="(player, i) in result.players">
                          <div class="player badge badge-info"
                              :style="playerColorStyle(player)">
                            {{player.name}}
                            <span v-if="player.points" class="points badge badge-dark">
                              <template v-if="player.points > 0">+</template>{{player.points}}
                            </span>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                </transition>
              </div>
              <div v-else-if="gameState === 'end'">
                <div class="card">
                  <div class="card-header">
                    {{ $t('Final score:') }}
                  </div>
                  <ul class="list-group list-group-flush">
                    <li v-if="playersByScore"
                        v-for="player in playersByScore"
                        class="list-group-item d-flex justify-content-between align-items-center">
                      <span>
                        <span class="player-color"
                          :style="{ backgroundColor: player.color }"
                        ></span>
                        {{ player.name }}
                      </span>
                      <span>
                        <i class="fas fa-check" v-if="player.ready"></i>
                        <span class="badge badge-primary">
                          {{ player.score }}
                        </span>
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div v-if="serverState.gameStarted && gameState !== 'results' && serverState.gameTimer" class="card-footer">
              <span class="float-left" style="height: 25px; margin: 0 10px; font-weight: bold;">
                {{ serverState.gameTimer }}s
              </span>
              <div class="progress" style="height: 25px">
                <div class="progress-bar" role="progressbar"
                     :class="{
                       'bg-warning': progression <= 35,
                       'bg-danger': progression <= 15
                     }"
                     :style="{width: `${progression}%`}"
                     :aria-valuenow="progression"
                     aria-valuemin="0"
                     :aria-valuemax="serverState.gameTimerMax">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <template v-if="debugState">
        <hr>
        
        <pre>{{ serverState }}</pre>
      </template>
    
    </div>
  </div>
</template>

<style>
  a, a:hover{
    color: #00A;
  }
  .screen {
    font-size: 20px;
    padding: 1rem;
  }
  
  .state-question, .state-vote {
    font-size: 30px;
  }
  
  .result .label {
    font-size: 40px;
  }

  .result .player, .result .fooler {
    position: relative;
    font-size: 30px;
  }
  .code {
    padding: 0 10px;
    color: #FFF;
  }
  .list-group-item {
    padding: 7px;
  }
  .vote .badge {
    margin: 0 5px;
  }
  .state-vote .badge {
    margin: 0 5px;
  }
  .player-color {
    width: 10px;
    height: 30px;
    display: flex;
    float: left;
    margin-right: 10px;
  }

  .result .vote {
    display: inline-block;
  }
  .result .vote .label {
    text-align: center;
    padding: 20px;
    transform: scale(0);
  }
  .result .vote .players {
    width: 100%;
  }
  .result .vote .player {
    transform: scale(0);
    background: #2db34a;
    padding: 5px;
    text-align: center;
    position: relative;
    top: -20px;
    margin: 5px 10px;
  }

  .result .player .points,
  .result .fooler .points {
    position: absolute;
    top: -20px;
    transform: scale(0);
    right: -30px;
    z-index: 500;
  }
</style>

<script scoped>
  import QRCode from "qrcode";
  import Color from 'color';
  import random from 'random';
  import { tween, styler, timeline } from 'popmotion';
  import Velocity from "velocity-animate";
  import server from "@/mixins/server.js";

  export default {
    name: 'screen',
    mixins: [server],
    props: ['room'],
    data () {
      let speech = null;
      if ('speechSynthesis' in window) {
        speech = new SpeechSynthesisUtterance();
        speech.volume = 0.6;
        speech.lang = 'fr-FR';
      }

      const timer = new Audio('/assets/timer.mp3');
      timer.volume = 0.3;

      const results = new Audio('/assets/results.mp3');
      results.volume = 0.3;
      
      const roll = new Audio('/assets/roll.mp3');
      roll.volume = 0.6;
      roll.addEventListener('ended', function() {
          this.currentTime = 0;
          this.play();
      }, false);
      
      const correct = new Audio('/assets/quizz_answer_correct.mp3');
      correct.volume = 0.4;

      const wrong = new Audio('/assets/quizz_answer_wrong.mp3');
      wrong.volume = 0.4;

      const theme = new Audio('/assets/main_theme_long.mp3');
      theme.loop = true;
      theme.volume = 0.3;
      theme.addEventListener('ended', function() {
          this.currentTime = 0;
          this.play();
      }, false);

      return {
        isConnected: false,
        roomCode: null,
        qrCode: null,
        random,
        sounds: {
          theme,
          timer,
          results,
          roll,
          correct,
          wrong,
        },
        speech,
      }
    },
    created: function () {
      if (this.room){
        this.roomCode = this.room;
        this.join('quizz', {screen: true}).then(this.onGameJoin);
      }
    },
    destroyed() {
      this.clearSounds()
    },
    computed: {
      progression: function() {
        return Math.round(this.serverState.gameTimer / this.serverState.gameTimerMax * 100);
      },
      players: function() {
        return this.serverState.players || [];
      },
      playersByScore: function() {
        if (!this.players) {
          return [];
        }
        let players = Object.values(this.players);
        players.sort((a, b) => b.score - a.score);
        return players;
      },
      gameURL: function() {
        return `${window.location.protocol}//${window.location.host}/remote/${this.currentRoomCode}`;
      },
    },
    watch: {
      currentRoomCode: function() {
        QRCode.toDataURL(this.gameURL).then((url) => {
          this.qrCode = url;
        });
        this.$router.push({ name: 'play', params: { room: this.currentRoomCode } });
      },
      'serverState.gameTimer'() {
        if ((this.gameState === 'question' || this.gameState === 'vote') && this.serverState.gameTimer <= 1) {
          this.sounds.timer.currentTime = 28.515;
        }
        if ((this.gameState === 'question') && this.serverState.gameTimer !== null) {
          if (this.sounds.timer.paused) {
            this.sounds.timer.play();
          }
        }
      },
      gameState() {
        this.clearSounds();
        if (this.gameState === 'lobby') {
          this.sounds.theme.play();
        }

        if (this.gameState === 'end') {
          this.sounds.results.play();
        }

        if (this.gameState === 'question') {
          // Read the question out loud
          if (this.speech) {
            this.speech.text = this.serverState.question.text.replace('____', '');
            this.speech.onend = () => {
              this.serverRoom.send({startTimer: true});
            };
            speechSynthesis.speak(this.speech);
          }
        }
        if (this.gameState === 'vote') {
          this.sounds.timer.play();
          if (this.speech) {
            this.speech.text = this.$t("Choose one of these answer:");
            speechSynthesis.speak(this.speech);
          }
        }
      }
    },
    methods: {
      clearSounds() {
        if ('speechSynthesis' in window) {
          speechSynthesis.cancel()
        }
        for (const i in this.sounds) {
          const sound = this.sounds[i];
          sound.pause();
          sound.currentTime = 0;
        }
      },
      playerColorStyle(player) {
        return {
          'background-color': `${player.color}`,
          'color': Color(player.color).isDark()? '#FFF' : '#000',
        };
      },
      createGame() {
        this.create('quizz', {screen: true}).then(this.onGameJoin);
      },
      onGameJoin(serverRoom) {
        serverRoom.listen("players/:id/:attribute", (change) => {
          if(change.path.attribute === 'ready' && change.value) {
            const player = this.serverState.players[change.path.id];
            new Audio('/assets/player/'+player.sound).play();
          }
        });
        serverRoom.listen("players/:id", (change) => {
          if (change.operation === "add") {
            new Audio('/assets/player/'+change.value.sound).play();
          }
        });
      },
      beforeEnter: function (el) {
        Array.from(el.children).map((node) => node.style.display = 'none')
      },
      enter: function (el, done) {
        const votes = Array.from(document.querySelectorAll('.result .vote'));
        votes.reduce((promise, vote, index) => {
          return promise
            .then((result) => {
              const animations = new Promise((resolve, reject) => {
                this.sounds.roll.currentTime = 0;
                this.sounds.roll.play();
                vote.style.display = 'block';
                const label = vote.querySelector('.label');
                const labelStyler = styler(label);
                const instructions = [];
                
                instructions.push(
                  {
                    track: 'label',
                    from: { scale: 0 },
                    to: { scale: 1 },
                    duration: 1000,
                  }
                );
                
                const players = Array.from(vote.querySelectorAll('.player'));
                const playerStylers = [];
                players.forEach((player, j) => {
                  playerStylers.push(styler(player));
                  instructions.push(
                    {
                      track: `player-${j}`,
                      from: { scale: 0, rotate: 0 },
                      to: { scale: 1, rotate: random.int(-15, 15) },
                      duration: 100,
                    }
                  );
                });
                instructions.push(
                  {
                    track: 'delay',
                    duration: random.float(1.5, 3) * 1000,
                  }
                );
                timeline(instructions).start({
                  update: (v) => {
                    labelStyler.set(v.label);
                    for(const k in playerStylers) {
                      playerStylers[k].set(v[`player-${k}`]);
                    }
                  },
                  complete: () => {
                    this.sounds.roll.pause();
                    label.classList.remove("badge-primary");
                    this.sounds.correct.currentTime = 0;
                    this.sounds.wrong.currentTime = 0;
                    label.querySelector('.result').style.display = 'inline-block';
                    label.querySelector(':not(.result)').style.display = 'none';
                    
                    if (vote.classList.contains('correct')) {
                      this.sounds.correct.play();
                      label.classList.add("badge-success");
                    } else {
                      this.sounds.wrong.play();
                      label.classList.add("badge-danger");
                    }

                    const scoreInstructions = [{
                      track: 'delay',
                      duration: 1500,
                    }];
                    const points = Array.from(vote.querySelectorAll('.points'));
                    const pointsStylers = [];
                    points.forEach((point, p) => {
                      pointsStylers.push(styler(point));
                      scoreInstructions.push(
                        {
                          track: `points-${p}`,
                          from: { scale: 0, rotate: 0 },
                          to: { scale: 1, rotate: 27 },
                          duration: 100,
                        }
                      );
                    });

                    timeline(scoreInstructions).start({
                      update: (w) => {
                        for(const l in pointsStylers) {
                          pointsStylers[l].set(w[`points-${l}`]);
                        }
                      },
                      complete: () => {
                        setTimeout(() => {
                          vote.style.display = 'none';
                          resolve();
                        }, 4000)
                      }
                    });
                  }
                });
              });
              return animations;
            });
        }, Promise.resolve()).then(() => {
          this.serverRoom.send({next: true});
        });

        // if (!votes.length) {
        //   this.serverRoom.send({next: true});
        // }

        done()
      },
      leave: function (el, done) {
      }
    }
  }
</script>

<i18n>
{
  "fr": {
    "Room code:": "Code de partie:",
    "New Game": "Nouvelle partie",
    "or": "ou",
    "Join a game:": "Rejoindre une partie : ",
    "Join": "Rejoindre",
    "Code": "Code",
    "Players:": "Joueurs:",
    "Game is paused.": "La partie est en pause.",
    "A player has been lost! The game will resume once they're back.": "Un joueur a été perdu! La partie reprendra une fois tout le monde revenue.",
    "Click start on your device to start the game.": "Cliquez \"Démarrer la partie\" sur votre appareil pour commencer la partie.",
    "Scan this image to join the game:": "Scannez cette image pour rejoindre la partie.",
    "Or go to:": "Ou allez à cette adresse:",
    "Choose one of these answer:": "Choisissez une de ces réponses:",
    "Vote results": "Résultats des votes",
    "Final score:": "Score final:",
    "No one voted, are you kidding?": "Personne n'a voté, vous rigolez?",
    "Questions:": "Questions:",
    "This game does not exist.": "Cette partie n'existe pas."
  }
}
</i18n>