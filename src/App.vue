<template>
  <div id="app" class="cover-container d-flex w-100 h-100 mx-auto flex-column">
    <router-view/>
  </div>
</template>

<script>

  export default {
    name: 'app',
    data() {
      return {
      };
    },
  }
</script>

<style>
  .btn-secondary,
  .btn-secondary:hover,
  .btn-secondary:focus {
    color: #333;
    text-shadow: none; /* Prevent inheritance from `body` */
    background-color: #fff;
    border: .05rem solid #fff;
  }
  
  /*
   * Base structure
   */
  
  html,
  body {
    height: 100%;
    background-color: #333;
  }
  
  body {
    display: -ms-flexbox;
    display: flex;
    color: #fff;
  }
  
  pre {
    background-color: #FFF;
    border-radius: 5px;
    text-shadow: none;
    text-align: left;
    padding: 15px;
  }
  
  pre, .card, .list-group {
    color: #212529;
    text-shadow: none;
  }
  
  input {
    background-color: #FFF;
    border: 1px solid;
    border-radius: 2px;
    color: #000;
    padding: 3px;
  }
</style>
