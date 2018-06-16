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
    <template v-if="isConnected">
      <div class="row">
        <div class="col">
          <div class="username float-right text-right">
            {{ playerName }}
          </div>
          <div class="timer float-left text-left">
            <span class="col-md-1" v-if="serverState.gameStarted && gameState !== 'results' && serverState.gameTimer">
              {{ serverState.gameTimer }}
            </span>
            <span v-if="serverState.gamePaused" style="font-size: 30px">
              {{ $t('Game is paused.') }}
            </span>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col game">
          <div v-if="gameState === 'lobby'">
            <input v-model="name" size="12" class="username"/>
            <br>
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
                   ref="answerInput"
                   :placeholder="$t('Your answer')"
                   @keyup.enter="answer"
                   style="margin-bottom: 10px;"
            />
            <button @click="answer" class="btn btn-secondary">
              {{ $t('Send') }}
            </button>
          </div>
          <div v-else-if="gameState === 'vote'">
            <div class="question">
              {{ serverState.question.text }}
            </div>
            <div class="card">
              <div class="card-header">
                {{ $t('Choose an answer:') }}
              </div>
              <div class="list-group">
                <button type="button"
                        class="list-group-item list-group-item-action"
                        v-for="answer in answersChoice"
                        @click="vote(answer)"
                        :class="{active: choosenAnswer === answer}"
                >
                  {{ answer }}
                </button>
              </div>
            </div>
          
          </div>
          <div v-else-if="gameState === 'end'">
            <button @click="restart"
                    v-if="!player.ready"
                    class="btn btn-secondary btn-lg">
                {{ $t('Continue playing') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
  .question {
    font-size: 40px;
    line-height: normal;
    margin: 10px 0;
  }
  .remote .btn {
    font-size: 70px;
    height: inherit;
  }
  .remote {
    font-size: 60px;
  }
  input.answer {
    text-transform: uppercase;
  }
  input.username {
    margin: 10px 0;
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
        roomCode: null,
        playerAnswerSent: null,
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
      },
      answersChoice() {
        const choices = this.serverState.answersChoice.filter((a) => {
          return !this.playerAnswerSent || a !== this.playerAnswerSent.toUpperCase();
        });
        console.log(this.playerAnswerSent.toUpperCase(), choices);
        return choices;
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
        const answer = this.$refs.answerInput;
        if (!answer.value) {
          return;
        }
        this.serverRoom.send({answer: answer.value});
        this.playerAnswerSent = answer.value;
        answer.value = null;
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
    "Name": "Nom",
    "I'm ready": "Je suis prêt",
    "I'm not ready!": "Je ne suis pas prêt!",
    "Game is paused.": "La partie est en pause.",
    "Your answer": "Votre réponse:",
    "Send": "Envoyer",
    "Choose an answer:": "Choisissez une réponse",
    "Continue playing": "Continuer à jouer",
    "This game does not exist.": "Cette partie n'existe pas."
  }
}
</i18n>