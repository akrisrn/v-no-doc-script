<template>
  <div id="sandbox">
    <div id="preview" v-html="html"></div>
    <div id="separator"></div>
    <textarea ref="textarea" v-model="text" class="ipt"></textarea>
  </div>
</template>

<script lang="ts">
  @vno.VPD.Component({ el: '#sandbox' })
  export default class Sandbox extends vno.Vue {
    // noinspection JSUnusedGlobalSymbols
    $refs!: {
      textarea: HTMLTextAreaElement
    };

    text = '';
    html = '';
    enableLS = true;
    key = 'sandbox';

    // noinspection JSUnusedGlobalSymbols
    created() {
      const data = document.querySelector('#sandbox')?.getAttribute('data');
      if (data) {
        this.enableLS = false;
        this.text = decodeURIComponent(data);
      } else {
        this.text = localStorage.getItem(this.key) || '';
      }
    }

    @vno.VPD.Watch('text')
    onTextChanged() {
      this.resize();
      vno.renderMD(vno.filePath, vno.title, this.text, false, vno.articleSelf.asyncResults).then(html => {
        this.html = html;
        this.$nextTick(() => vno.updateDom());
      });
      if (!this.enableLS) {
        return;
      }
      if (this.text) {
        localStorage.setItem(this.key, this.text);
      } else {
        localStorage.removeItem(this.key);
      }
    }

    resize() {
      this.$refs.textarea.style.height = '';
      this.$refs.textarea.style.height = `${this.$refs.textarea.scrollHeight}px`;
    }
  }
</script>

<style lang="scss" scoped>@import "../styles/sandbox";</style>
