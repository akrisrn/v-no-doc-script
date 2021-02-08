<template>
  <div id="sandbox">
    <div id="preview" v-html="html"></div>
    <div id="separator"></div>
    <textarea ref="textarea" v-model="text" class="ipt"></textarea>
  </div>
</template>

<script lang="ts">
  @vno.VPD.Component({
    el: '#sandbox',
  })
  export default class Sandbox extends vno.Vue {
    $refs!: {
      textarea: HTMLTextAreaElement
    };

    text = '';
    html = '';
    enableLS = true;
    item = 'sandbox';

    created() {
      const data = document.querySelector('#sandbox')?.getAttribute('data');
      if (data) {
        this.enableLS = false;
        this.text = decodeURIComponent(data);
      } else {
        this.text = localStorage.getItem(this.item) || '';
      }
    }

    @vno.VPD.Watch('text')
    onTextChanged() {
      this.resize();
      vno.renderMD(vno.filePath, this.text, vno.articleSelf.asyncResults).then(html => {
        this.html = html;
        this.$nextTick(() => vno.updateDom());
      });
      if (this.enableLS) {
        if (this.text) {
          localStorage.setItem(this.item, this.text);
        } else {
          localStorage.removeItem(this.item);
        }
      }
    }

    resize() {
      this.$refs.textarea.style.height = '';
      this.$refs.textarea.style.height = `${this.$refs.textarea.scrollHeight}px`;
    }
  };
</script>

<style lang="scss" scoped>
  #sandbox {
    display: flex;
    margin-bottom: 24px;

    #preview, textarea {
      width: 50%;
    }

    #preview {
      > :first-child {
        margin-top: 0;
      }

      > :last-child {
        margin-bottom: 0;
      }
    }

    #separator {
      margin: 0 16px;
      border-left: 6px solid rgba(var(--info-color), 0.5);
    }

    textarea {
      margin: 0;
      padding: 0;
      resize: none;
      border-left: none;
    }
  }
</style>
