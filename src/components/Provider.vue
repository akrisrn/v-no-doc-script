<template>
  <div id="provider" :class="isZen ? 'hidden' : null">
    <img :src="logo" alt="logo" height="32">
    <div v-html="html"></div>
  </div>
</template>

<script lang="ts">
  @vno.VPD.Component({
    el: document.createElement('div'),
  })
  export default class Provider extends vno.Vue {
    isZen = vno.gadgetSelf.isZen;
    logo = vno.path.addBaseUrl('/uploads/images/logo.png');
    powered = ['@akrisrn/v-no', 'https://github.com/akrisrn/v-no'];
    hosted = ['GitHub Pages', 'https://github.com/akrisrn/v-no-doc'];

    get html() {
      return vno.markdown.renderMD(vno.getMessage('components.provider', [
        this.powered,
        this.hosted,
      ].map(link => `[${link[0]}](${link[1]})`)), false);
    }

    mounted() {
      document.addEventListener(vno.EEvent.toggleZen, event => {
        if ((event as CustomEvent).detail === true) {
          setTimeout(() => {
            this.isZen = true;
          }, 500);
        } else {
          this.isZen = false;
          this.$nextTick(() => {
            if (this.$el.classList.length === 0) {
              this.$el.removeAttribute('class');
            }
          });
        }
      });
    }
  }
</script>

<style lang="scss" scoped>
  #provider {
    font-size: var(--font-size-s);
    margin: 40px 0;
    transition: opacity 0.5s, margin 0.5s;
    text-align: center;
    opacity: 1;
    color: var(--gray-font-color);

    &.hidden {
      visibility: hidden;
      height: 0;
      margin: 0;
    }

    > div {
      > :first-child {
        margin-top: 0;
      }

      > :last-child {
        margin-bottom: 0;
      }
    }

    @media screen and (max-width: 800px) {
      margin: 24px 0;
    }
  }

  body.zen #provider {
    opacity: 0;
  }
</style>
