<template>
  <div id="provider" :class="isZen ? 'hidden' : null">
    <img :src="logo" alt="logo" height="32">
    <div v-html="html"></div>
  </div>
</template>

<script lang="ts">
  @vno.VPD.Component({ el: document.createElement('div') })
  export default class Provider extends vno.Vue {
    isZen = vno.gadgetSelf.isZen;
    logo = vno.path.addBaseUrl(vno.getMessage('paths.logo'));
    powered = JSON.parse(vno.getMessage('links.powered')) as [string, string];
    hosted = JSON.parse(vno.getMessage('links.hosted')) as [string, string];

    get html() {
      return vno.markdown.renderMD(vno.getMessage('components.provider', [
        this.powered,
        this.hosted,
      ].map(link => `[${link[0]}](${link[1]})`)), false);
    }

    // noinspection JSUnusedGlobalSymbols
    mounted() {
      document.querySelector('#app')!.append(this.$el);
      document.addEventListener(vno.EEvent.toggleZen, event => {
        if ((event as CustomEvent).detail === true) {
          setTimeout(() => {
            this.isZen = true;
          }, 500);
        } else {
          this.isZen = false;
          this.$nextTick(() => vno.element.removeClass(this.$el));
        }
      });
    }
  }
</script>

<style lang="scss" scoped>@import "../styles/provider";</style>
