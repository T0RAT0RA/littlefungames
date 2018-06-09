<template>
  <div class="remote">
    <div class="row" v-if="!isConnected">
      <div class="col">
        <form @submit.prevent="join('quizz', {name})">
          <input v-model="roomCode" autofocus
                 :placeholder="$t('Code')" size="8" maxlength="6"/>
          <button class="btn btn-secondary btn-lg" type="submit">
            {{ $t('Join') }}
          </button>
        </form>
        
        <p class="text-danger" v-if="serverError">
          {{ serverError }}
        </p>
      </div>
    </div>
    <div class="row" v-if="isConnected" style="margin-top: 30px;">
      <div class="username text-right fixed-top"><b>{{ playerName }}</b></div>
      
      <div class="col-md-1" v-if="!settings">
        <i class="fas fa-bars" @click="settings = !settings" ></i>
      </div>
      <div class="col-md-12" v-if="settings">
        <div class="settings">
          <div class="card">
            <div class="card-header">
              {{ $t('Settings') }} <i class="far fa-times-circle" @click="settings = !settings"></i>
            </div>
            <ul class="list-group list-group-flush">
              <li class="list-group-item">
                {{ $t('Name') }}:<br>
                <input v-model="name" size="12" :disabled="serverState.gameStarted"/>
              </li>
              <li class="list-group-item list-group-item-warning" v-if="debug">
                ID: {{ player.id }}
                <button @click="next"
                        class="btn btn-warning">
                  NEXT (debug)
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <div class="col game">
        <div v-if="gameState === 'lobby'">
          {{ $t('lobby') }}<br>
          
          <button @click="start"
                  v-if="!player.ready"
                  class="btn btn-secondary btn-lg">{{ $t('I\'m ready') }}
          </button>
          <button @click="pause"
                  v-if="player.ready"
                  class="btn btn-warning btn-lg">{{ $t('I\'m not ready!') }}
          </button>
        </div>
        <div v-else-if="gameState === 'question'">
          <input class="answer"
                 v-model="playerAnswer"
                 :placeholder="$t('Your answer')"
                 @keyup.enter="answer"/>
          <br><br>
          <button @click="answer" class="btn btn-secondary btn-lg">
            {{ $t('Send') }}
          </button>
        </div>
        <div v-else-if="gameState === 'vote'">
          <div class="card">
            <div class="card-header">
              {{ $t('Choose an answer:') }}
            </div>
            <div class="list-group">
              <button type="button"
                      class="list-group-item list-group-item-action"
                      v-for="answer in serverState.answersChoice"
                      @click="vote(answer)"
                      :class="{active: choosenAnswer === answer}"
              >
                {{ answer }}
              </button>
            </div>
          </div>
        
        </div>
        <!--<div v-else-if="gameState === 'results'">-->
        <!--ANSWER: <b>{{ serverState.question.answer }}</b>-->
        <!--</div>-->
        <div v-else-if="gameState === 'end'">
          
          <button @click="restart"
                  v-if="!player.ready"
                  class="btn btn-secondary btn-lg">
              {{ $t('Continue playing') }}
          </button>
        </div>
      </div>
      
    </div>
  </div>
</template>

<style>
  .remote .btn {
    font-size: 80px;
    height: inherit;
  }
  .remote {
    font-size: 60px;
  }
  input.answer {
    text-transform: uppercase;
  }
  .username {
    padding: 0 10px;
    color: #FFF;
    font-size: 30px;
  }
</style>

<script>
  import server from "@/mixins/server.js";

  export default {
    name: 'remote',
    mixins: [server],
    props: ['room'],
    data() {
      return {
        settings: false,
        roomCode: null,
        playerAnswer: null,
        choosenAnswer: null,
      }
    },
    created: function () {
      if (this.room) {
        this.roomCode = this.room;
        this.join('quizz', {
          name: this.name,
        });
      }
    },
    computed: {
      player: function () {
        if (this.client && this.serverState.players && this.serverState.players[this.client.id]) {
          return this.serverState.players[this.client.id];
        }
        return {};
      },
      playerName: function () {
        return this.player.name;
      },
      name: {
        get: function () {
          return this.playerName || localStorage.getItem('name') || null;
        },
        set: function (name) {
          localStorage.setItem('name', name);
          if (name){
            this.serverRoom.send({newName: name});
          }
        }
      }
    },
    watch: {
      currentRoomCode: function() {
        this.$router.push({ name: 'remote', params: { room: this.currentRoomCode } });
      }
    },
    methods: {
      start: function () {
        this.serverRoom.send({startGame: true});
      },
      restart: function () {
        this.serverRoom.send({startNewGame: true});
      },
      pause: function () {
        this.serverRoom.send({pauseGame: true});
      },
      answer: function () {
        if (!this.playerAnswer) {
          return;
        }
        this.serverRoom.send({answer: this.playerAnswer});
        this.playerAnswer = null;
      },
      vote: function (answer) {
        if (this.choosenAnswer === answer) {
          this.choosenAnswer = null;
        } else {
          this.choosenAnswer = answer;
        }
        this.serverRoom.send({vote: this.choosenAnswer});
      },
      next: function () {
        this.serverRoom.send({next: true});
      },
    }
  }
</script>

<i18n>
{
  "fr": {
    "Join": "Rejoindre",
    "Code": "Code",
    "Settings": "Paramètres",
    "Name": "Nom",
    "I'm ready": "Je suis prêt",
    "I'm not ready!": "Je ne suis pas prêt!",
    "Your answer": "Votre réponse:",
    "Send": "Envoyer",
    "Choose an answer:": "Choisissez une réponse",
    "Continue playing": "Continuer à jouer"
  }
}
</i18n>