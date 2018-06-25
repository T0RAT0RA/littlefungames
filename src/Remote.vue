<template>
  <div class="remote">
    <div class="row" v-if="!isConnected" style="padding: 1rem;">
      <div class="col">
        <form @submit.prevent="joinGame()">
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
      <div class="row header" :style="headerStyle">
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
            <input ref="name" size="12" class="username"
                   @keyup="updateName"
                   @change="updateName"/>
            <br>
            <button @click="start"
                    v-if="!player.ready"
                    class="btn btn-secondary btn-lg">{{ $t('Start the game') }}
            </button>
            <button @click="pause"
                    v-if="player.ready"
                    class="btn btn-warning btn-lg">{{ $t('Wait!') }}
            </button>
          </div>
          <div v-else-if="gameState === 'question'">
            <input class="answer"
                   ref="answerInput"
                   :placeholder="$t('Your answer')"
                   @keyup.enter="answer"
                   style="margin-bottom: 10px;"
            />
            <div class="answer-warning badge badge-warning" v-if="answerWarning">{{answerWarning}}</div>
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

<style scoped>
  .row {
    margin: 0;
  }
  .header {
    margin-bottom: 15px;
  }
  .question {
    font-size: 30px;
    line-height: normal;
    margin: 10px 0;
  }
  .remote .btn {
    font-size: 50px;
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
  .answer-warning {
    font-size: 30px;
    display: block;
  }
</style>

<script>
  import Color from 'color';
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
        answerWarning: null,
      }
    },
    created: function () {
      if (this.room) {
        this.roomCode = this.room;
        this.joinGame();
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
      answersChoice() {
        const choices = this.serverState.answersChoice.filter((a) => {
          return !this.playerAnswerSent || a !== this.playerAnswerSent.toUpperCase();
        });
        return choices;
      },
      headerStyle() {
        return {
          background: this.player.color,
          color: Color(this.player.color).isDark()? '#FFF' : '#000',
        };
      },
    },
    watch: {
      playerName(name) {
        //Fixed an issue where $refs.name is not yet rendered
        setTimeout(() => {
          this.$refs.name.value = name || localStorage.getItem('name') || null;
        }, 0)
      },
      gameState() {
        if (this.gameState === 'lobby') {
          //Fixed an issue where $refs.name is not yet rendered
          setTimeout(() => {
            this.$refs.name.value = name || localStorage.getItem('name') || null;
          }, 10)
        }
        if (this.gameState === 'question') {
          setTimeout(() => {
            this.$refs.answerInput.value = null;
          }, 10)
        }
        if (this.gameState === 'vote') {
          this.choosenAnswer = null;
        }
      },
      currentRoomCode: function() {
        this.$router.push({ name: 'remote', params: { room: this.currentRoomCode } });
      }
    },
    methods: {
      joinGame() {
        this.join('quizz', {
          name: localStorage.getItem('name') || null,
        }).then(this.onGameJoin);
      },
      updateName() {
        const name = this.$refs.name.value;
        localStorage.setItem('name', name);
        if (name){
          this.serverRoom.send({newName: name});
        }
      },
      onGameJoin(serverRoom) {
        serverRoom.listen("gameTimer", (change) => {
          if(change.value <= 0) {
            if (window.navigator) {
              window.navigator.vibrate(200);
            }
          }
        });
      },
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

        this.answerWarning = null;

        if (!answer.value) {
          return;
        }

        if (answer.value.toUpperCase() === this.serverState.question.answer.toUpperCase()
          || (
               this.serverState.question.alternateSpellings
            && this.serverState.question.alternateSpellings.filter(
                      a => a.toUpperCase() === answer.value.toUpperCase()
               ).length
          )
        ) {
          this.notifyCorrectAnswer();
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
      notifyCorrectAnswer() {
        this.answerWarning  = this.$t('This is the correct answer, change it!')
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
    "Start the game": "Démarrer la partie",
    "Wait!": "Attendez!",
    "Game is paused.": "La partie est en pause.",
    "Your answer": "Votre réponse:",
    "Send": "Envoyer",
    "Choose an answer:": "Choisissez une réponse",
    "Continue playing": "Continuer à jouer",
    "This game does not exist.": "Cette partie n'existe pas.",
    "This is the correct answer, change it!": "C'est la bonne réponse, change la!"
  }
}
</i18n>