import * as Colyseus from "colyseus.js";

export default {
  data() {
    return {
        debug: process.env.DEBUG || false,
        debugState: process.env.DEBUG || false,
        client: null,
        serverError: null,
        isConnected: false,
        gameState: null,
        serverState: {},
        serverRoom: null,
        roomCode: null,
    };
  },

  created: function () {
    this.client = new Colyseus.Client(`ws://${window.location.hostname}:9090`);

    this.client.onError.add((err) => {
      switch (err) {
        case 'join_request_fail_room_unknown':
          this.serverError = this.$t('This game does not exist.');
          break;
        case 'join_request_fail_game_in_progress':
          this.serverError = this.$t('This game is in progress.');
          break;
        case 'join_request_fail':
          this.serverError = this.$t('Could not join requested game.');
          break;
        default:
          this.serverError = `An error occured: ${err}.`;
      }
    });
  },

  computed: {
      currentRoomCode: function() {
        return this.serverState.code;
      }
  },

  methods: {
    create: function(roomType, options) {
      this.connect(roomType, options)
    },

    join: function(roomType, options) {
      console.log('JOIN METHOD', roomType, options);
      if (!this.roomCode) {
        return;
      }

      this.connect(roomType, {
        ...options,
        code: this.roomCode
      })
    },

    connect: function(roomType = 'quizz', options = {}) {
      this.serverError = null;

      try {
        this.serverRoom = this.client.join(roomType, options);
      } catch(err) {
        console.log('couldn\'t find room.', err);
        return;
      }

      this.serverRoom.onJoin.add(() => {
        this.isConnected = true;
      });

      this.serverRoom.onLeave.add(() => {
        this.isConnected = false;
      });

      this.serverRoom.onError.add((err) => {
        this.isConnected = false;
      });

      this.serverRoom.onStateChange.add((state) => {
        this.serverState = state;
      });

      this.serverRoom.listen("state", (change) => {
        this.gameState = change.value;
      })
    },
  },
}