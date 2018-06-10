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
              <li v-if="playersByScore"
                  v-for="player in playersByScore"
                  class="list-group-item d-flex justify-content-between align-items-center"
                  :class="{
                    'list-group-item-warning': player.disconnected
                  }">
                <span>{{ player.name }}</span>
                <span>
                  <i class="fas fa-check" v-if="player.ready"></i>
                  <template v-if="player.disconnected">
                    <i class="fas fa-exclamation-triangle"></i>
                  </template>
                  <span class="badge badge-primary"
                        v-if="gameState !== 'lobby'">
                    {{ player.score }}
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>
        
        <div class="col-sm-9">
          <div class="alert alert-warning" role="alert" v-if="serverState.gamePaused">
            {{ $t('Game is paused.') }}
            {{ serverState.gamePausedMessage }}
          </div>
          
          <div class="card">
            <div class="card-header" style="padding: 5px 20px;">
              <div class="float-left">
                {{ $t('Questions:') }} {{ `${serverState.questionsAsked}/${serverState.maxQuestions}` }}
              </div>
              <div class="float-right">Room code: <b>{{ serverState.code }}</b></div>
            </div>
            <div class="card-body">
              <div v-if="gameState === 'lobby'">
                <!--<img class="card-img-top" src="//placehold.it/186x80" alt="Card image cap">-->
                <h5 class="card-title">
                  {{ $t('Lobby') }}
                </h5>
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
                {{ $t('Vote results') }}<br>
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
                      <div class="label badge"
                        :class="{
                          'badge-success': result.type == 'correct',
                          'badge-secondary': result.type != 'correct'
                        }">
                        {{result.vote}}
                        <div v-if="result.type == 'correct'" style="font-size: 20px">Bonne réponse!</div>
                      </div>
                      <br><br>
                      
                      <div v-for="player in result.players"
                          class="player badge badge-info">
                        {{player.name}}
                      </div>
                      <template v-if="result.players.length == 1">
                        a voté
                      </template>
                      <template v-if="result.players.length > 1">
                        ont voté
                      </template>
                      
                      <div v-if="result.type == 'fool'">
                        <br><br>
                        <div v-for="player in result.foolers"
                             class="fooler badge badge-danger">
                          {{player.name}}
                        </div>
                        <span v-if="result.foolers.length == 1">
                          vous a eu!
                        </span>
                        <span v-if="result.foolers.length > 1">
                          vous ont eu!
                        </span>
                      </div>
                      
                      <span v-if="result.type == 'trap'">
                        mais c'était un piège!
                      </span>
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
            <div v-if="serverState.gameStarted && gameState !== 'results'" class="card-footer">
              <span class="float-left" style="height: 25px; margin: 0 10px; font-weight: bold;">
                {{ gameTimer }}s
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
  }
  
  .state-question, .state-vote {
    font-size: 40px;
  }
  
  .result .label {
    font-size: 70px;
  }
  
  .result .player, .result .fooler {
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
</style>

<script>
  import QRCode from "qrcode";
  import Velocity from "velocity-animate";
  import server from "@/mixins/server.js";

  export default {
    name: 'screen',
    mixins: [server],
    props: ['room'],
    data () {
      return {
        isConnected: false,
        gameTimer: null,
        roomCode: null,
        qrCode: null,
        players: {},
      }
    },
    created: function () {
      if (this.room){
        this.roomCode = this.room;
        this.join('quizz', {screen: true}).then((serverRoom) => {
          serverRoom.onMessage.add((message) => {
            if (message.gameTimer) {
              this.gameTimer = message.gameTimer;
            }
          });
        });
      }
    },
    computed: {
      progression: function() {
        return Math.round(this.gameTimer / this.serverState.gameTimerMax * 100);
      },
      playersByScore: function() {
        if (!this.serverState.players) {
          return [];
        }
        let players = Object.values(this.serverState.players);
        players.sort((a, b) => b.score - a.score);
        return players;
      },
      gameURL: function() {
        return `${window.location.protocol}//${window.location.host}/remote/${this.currentRoomCode}`;
      }
    },
    watch: {
      currentRoomCode: function() {
        QRCode.toDataURL(this.gameURL).then((url) => {
          this.qrCode = url;
        });
        this.$router.push({ name: 'play', params: { room: this.currentRoomCode } });
      }
    },
    methods: {
      createGame() {
        this.create('quizz', {screen: true}).then((serverRoom) => {
          serverRoom.onMessage.add((message) => {
            if (message.gameTimer) {
              this.gameTimer = message.gameTimer;
            }
          });
        });
      },
      beforeEnter: function (el) {
        Array.from(el.children).map((node) => node.style.display = 'none')
      },
      enter: function (el, done) {
        let votes = Array.from(el.children);
        
        const TIME_DISPLAYED = 6000;
        const TIME_FADE_OUT = 250;
        
        for (let i in votes) {
          let vote = votes[i];
          
          Velocity(vote, 'fadeIn', { display: 'block', delay: i * (TIME_FADE_OUT + TIME_DISPLAYED + 1000) });
          Velocity(vote, "fadeOut", { delay: TIME_DISPLAYED}).then(() => {
            if (parseInt(i)+1 === votes.length) {
              this.serverRoom.send({next: true});
            }
          });
        }

        if (!votes.length) {
          this.serverRoom.send({next: true});
        }

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
    "New Game": "Nouvelle partie",
    "or": "ou",
    "Join a game:": "Rejoindre une partie : ",
    "Join": "Rejoindre",
    "Code": "Code",
    "Players:": "Joueurs:",
    "Game is paused.": "La partie est en pause.",
    "Click start on your device to start the game.": "Cliquez \"Je suis prêt\" sur votre appareil pour commencer la partie.",
    "Scan this image to join the game:": "Scannez cette image pour rejoindre la partie.",
    "Or go to:": "Ou allez à cette adresse:",
    "Lobby": "Lobby",
    "Choose one of these answer:": "Choisissez une de ces réponses:",
    "Vote results": "Résultats des votes",
    "Final score:": "Score final:",
    "No one voted, are you kidding?": "Personne n'a voté, vous rigolez?"
  }
}
</i18n>