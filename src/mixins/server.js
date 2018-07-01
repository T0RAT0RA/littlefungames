import * as Colyseus from 'colyseus.js';

export default {
  data() {
    return {
      debug: false,
      debugState: false,
      client: null,
      serverError: null,
      isConnected: false,
      gameState: null,
      serverState: {},
      serverRoom: null,
      roomCode: null,
    };
  },

  created() {
    const host = window.document.location.host.replace(/:.*/, '');
    const ws = `${window.location.protocol.replace('http', 'ws')}//${host}${window.location.port ? `:${window.location.port}` : ''}`;
    this.client = new Colyseus.Client(ws);

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
    currentRoomCode() {
      return this.serverState.code;
    },
  },

  methods: {
    create(roomType, options) {
      return this.connect(roomType, options);
    },

    join(roomType, options) {
      if (!this.roomCode) {
        return Promise.reject(new Error('missing_room_code'));
      }

      return this.connect(roomType, {
        ...options,
        code: this.roomCode,
      });
    },

    connect(roomType = 'quizz', options = {}) {
      this.serverError = null;

      try {
        this.serverRoom = this.client.join(roomType, options);
      } catch (err) {
        return Promise.reject(new Error(err));
      }

      this.serverRoom.onJoin.add(() => {
        this.isConnected = true;
      });

      this.serverRoom.onLeave.add(() => {
        this.isConnected = false;
      });

      this.serverRoom.onError.add(() => {
        this.isConnected = false;
      });

      this.serverRoom.onStateChange.add((state) => {
        this.serverState = state;
      });

      this.serverRoom.listen('state', (change) => {
        this.gameState = change.value;
      });

      return Promise.resolve(this.serverRoom);
    },
  },
};
