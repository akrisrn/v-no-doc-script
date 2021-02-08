<template>
  <div id="console">
    <input v-model.trim="evalStr" class="ipt" @keyup.enter="submit">
    <div v-for="(result, i) of results" :key="i" class="result">
      <div v-html="result.code"></div>
      <div :class="['value', { error: result.isError }]">
        <span v-if="result.isAsync" v-html="result.value"></span>
        <template v-else>{{ result.value }}</template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
  @vno.VPD.Component({
    el: '#console',
  })
  export default class Console extends vno.Vue {
    evalStr = '';
    results: {
      code: string,
      isError: boolean,
      isAsync: boolean,
      value: string
    }[] = [];

    created() {
      this.reset();
    }

    reset() {
      this.evalStr = 'return ';
    }

    submit() {
      const evalStr = this.evalStr;
      const isAsync = evalStr.indexOf('await ') >= 0;
      const [value, isError] = vno.utils.evalFunction(evalStr, {
        path: vno.filePath,
        data: vno.mainSelf.fileData,
      }, vno.articleSelf.asyncResults);
      this.results.unshift({
        code: vno.markdown.renderMD(`\`\`\`js\n${evalStr}\n\`\`\``, false),
        isError, isAsync, value,
      });
      this.reset();
      this.$nextTick(() => {
        vno.articleSelf.asyncResults.forEach(result => {
          vno.markdown.updateAsyncScript(result);
        });
        vno.markdown.updateDom();
      });
    }
  }
</script>

<style lang="scss" scoped>
  #console, #console input {
    font-family: var(--mono-font-family);
  }

  #console {
    .result {
      margin-top: 16px;
    }

    .value:before {
      font-weight: bold;
      margin-right: 8px;
      content: ">";
    }
  }
</style>
