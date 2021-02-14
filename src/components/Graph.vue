<template>
  <div id="graph" :style="style">
    <canvas ref="canvas" :height="height" :width="width"></canvas>
  </div>
</template>

<script lang="ts">
  import {
    ForceCollide,
    ForceLink,
    ForceX,
    ForceY,
    Simulation,
    SimulationLinkDatum,
    SimulationNodeDatum,
    ZoomBehavior,
    ZoomTransform,
  } from 'd3';

  interface NodeDatum extends SimulationNodeDatum {
    id: string;
    name: string;
    tags: string[];
    radius: number;
    innerRadius?: number;
    alpha?: number;
  }

  interface LinkDatum extends SimulationLinkDatum<NodeDatum> {
    source: NodeDatum;
    target: NodeDatum;
    alpha?: number;
  }

  function strToRGB(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hex = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return `#${'00000'.substring(0, 6 - hex.length)}${hex}`;
  }

  @vno.VPD.Component({ el: '#graph' })
  export default class Graph extends vno.Vue {
    // noinspection JSUnusedGlobalSymbols
    $refs!: {
      canvas: HTMLCanvasElement;
    };

    isLoading = true;
    loadingText = vno.getMessage('loading', []);

    isError = false;
    errorText = vno.getMessage('components.graph.error', []);

    width = 0;
    height = 700;

    PI_2 = Math.PI * 2;
    PI_HALF = Math.PI / 2;

    nodeRadiusUnit = 2;
    nodeMinRadius = 8;
    nodeMaxRadius = this.nodeMinRadius + this.nodeRadiusUnit * 46;

    linkWidth = 4;
    halfLinkWidth = this.linkWidth / 2;

    linkArrowLength = 10;
    linkArrowAngle = Math.PI / 16;
    linkArrowLengthSin = this.linkArrowLength * Math.sin(this.linkArrowAngle);
    linkArrowLengthCos = this.linkArrowLength * Math.cos(this.linkArrowAngle);
    linkArrowLengthSin2 = this.linkArrowLengthSin * 2;

    canvasAlpha = 0.2;
    interpolate = 0;

    canvasCtx!: CanvasRenderingContext2D;
    simulation!: Simulation<NodeDatum, LinkDatum>;
    zoom!: ZoomBehavior<HTMLCanvasElement, unknown>;
    transform!: ZoomTransform;

    nodes: NodeDatum[] = [];
    links: LinkDatum[] = [];
    linkCount: Dict<[string[], string[]]> = {};

    selectedNodeOrLink: NodeDatum | LinkDatum | null = null;

    draggedLinkSourceOffsetXY: [number, number] | null = null;
    draggedLinkTargetOffsetXY: [number, number] | null = null;

    canvasNoTransXY = [0, 0];

    get style() {
      return {
        width: `${this.width}px`,
        height: `${this.height}px`,
      };
    }

    get canvasXY() {
      const [x, y] = this.canvasNoTransXY;
      return this.transformXY(x, y);
    }

    get selectedNode() {
      return this.selectedNodeOrLink as NodeDatum;
    }

    get selectedLink() {
      return this.selectedNodeOrLink as LinkDatum;
    }

    get isSelectedNode() {
      return !!(this.selectedNodeOrLink && !this.selectedLink.source);
    }

    get isSelectedLink() {
      return !!(this.selectedNodeOrLink && this.selectedLink.source);
    }

    get selectedLinkNodeIndices() {
      return [this.selectedLink.source.index, this.selectedLink.target.index];
    }

    get selectedLinkCount() {
      return this.linkCount[this.selectedNode.id];
    }

    // noinspection JSUnusedGlobalSymbols
    created() {
      const article = document.querySelector('article')!;
      const setWidth = () => {
        this.width = article.clientWidth;
      };
      setWidth();
      window.onresize = setWidth;
    }

    // noinspection JSUnusedGlobalSymbols
    mounted() {
      const canvas = this.$refs.canvas;
      this.canvasCtx = canvas.getContext('2d')!;
      this.ticked();

      vno.waitFor(() => {
        // noinspection BadExpressionStatementJS
        d3;
      }).then(success => {
        if (!success) {
          this.isError = true;
          this.ticked();
          return;
        }

        this.transform = d3.zoomIdentity;

        this.$watch('width', () => {
          const [x, y] = this.transformXY(this.width / 2, this.height / 2);
          this.forceXY(x, y, true);
          this.restartSimulationWithAlpha();
        });
        this.$watch('selectedNodeOrLink', () => {
          this.interpolate = 0;
          this.restartSimulationWithAlpha(false, 0.1);
        });

        this.simulation = d3.forceSimulation(this.nodes)
            .force('charge', d3.forceManyBody<NodeDatum>().strength(node => {
              return -Math.log2(this.nodeMaxRadius - node.radius + 2) * 100;
            }))
            .force('link', d3.forceLink<NodeDatum, LinkDatum>(this.links).id(node => node.id))
            .on('tick', this.ticked);
        this.forceXY(this.width / 2, this.height / 2);
        this.forceCollide();

        this.zoom = d3.zoom<HTMLCanvasElement, unknown>()
            .scaleExtent([1 / 10, 10])
            .on('zoom', this.zoomed);
        d3.select(canvas)
            .call(d3.drag<HTMLCanvasElement, unknown>()
                .subject(this.dragSubject)
                .on('start', this.dragStarted)
                .on('drag', this.dragged)
                .on('end', this.dragEnded))
            .call(this.zoom)
            .on('mousemove', this.mouseMoved);

        this.initNodes();
      });
    }

    initNodes() {
      vno.file.getFiles().then(({ files }) => {
        this.isLoading = false;
        const nodeDict: Dict<NodeDatum | undefined> = {};
        Object.keys(files).forEach(path => {
          if (nodeDict[path] === undefined) {
            this.createNodeFromFile(path, files, nodeDict);
          }
        });
      });
    }

    createNodeFromFile(path: string, files: Dict<IFile>, nodeDict: Dict<NodeDatum | undefined>) {
      const file = files[path];
      const source = this.addNode(path, file.flags.title, file.flags.tags);
      nodeDict[path] = source;
      Object.keys(file.links).forEach(targetPath => {
        const link = file.links[targetPath];
        if (!link.isMarkdown) {
          return;
        }
        let target = nodeDict[targetPath];
        if (target === undefined) {
          target = this.createNodeFromFile(targetPath, files, nodeDict);
        }
        this.addLink(source, target);
      });
      return source;
    }

    forceXY(x: number, y: number, isReForce = false) {
      if (isReForce) {
        this.simulation.force<ForceX<NodeDatum>>('x')!.x(x);
        this.simulation.force<ForceY<NodeDatum>>('y')!.y(y);
        return;
      }
      this.simulation.force('x', d3.forceX(x));
      this.simulation.force('y', d3.forceY(y));
    }

    forceCollide(isReForce = false) {
      const radius = (node: NodeDatum) => node.radius + this.nodeRadiusUnit * 10;
      if (isReForce) {
        this.simulation.force<ForceCollide<NodeDatum>>('collide')!.radius(radius);
        return;
      }
      this.simulation.force('collide', d3.forceCollide<NodeDatum>().radius(radius));
    }

    ticked() {
      this.canvasCtx.lineWidth = this.linkWidth;
      this.canvasCtx.textAlign = 'center';

      this.canvasCtx.save();
      this.canvasCtx.clearRect(0, 0, this.width, this.height);

      if (this.isLoading) {
        this.canvasCtx.font = '80px sans-serif';
        this.canvasCtx.fillStyle = this.isError ? '#ff0000' : '#424242';
        this.canvasCtx.fillText(this.isError ? this.errorText : this.loadingText, this.width / 2, this.height / 2);
      } else {
        this.canvasCtx.translate(this.transform.x, this.transform.y);
        this.canvasCtx.scale(this.transform.k, this.transform.k);

        this.links.forEach(link => this.drawLink(link));
        this.nodes.forEach(node => this.drawNode(node));
      }

      this.canvasCtx.restore();
      this.increaseInterpolate();
    }

    drawLink(link: LinkDatum) {
      let isSelected = false;
      if (this.isSelectedLink) {
        if (this.selectedLink.index === link.index) {
          isSelected = true;
        }
      } else if (this.isSelectedNode && [link.source.index, link.target.index].includes(this.selectedNode.index)) {
        isSelected = true;
      }
      this.drawLinkFrom(link.source, link.target, isSelected, link);
    }

    drawLinkFrom(source: NodeDatum, target: NodeDatum, isSelected: boolean, link?: LinkDatum) {
      const linkAngle = Math.atan2(target.y! - source.y!, target.x! - source.x!);
      const sinLinkAngle = Math.sin(linkAngle);
      const cosLinkAngle = Math.cos(linkAngle);

      let offsetSourceRadius = source.radius;
      const sourceLinkCount = this.linkCount[source.id];
      if (sourceLinkCount[0].includes(target.id) && sourceLinkCount[1].includes(target.id)) {
        offsetSourceRadius += this.linkArrowLengthCos;
      }
      const offsetSourceX = source.x! + offsetSourceRadius * cosLinkAngle;
      const offsetSourceY = source.y! + offsetSourceRadius * sinLinkAngle;

      const offsetTargetRadius = target.radius + this.linkArrowLengthCos;
      const offsetTargetX = target.x! - offsetTargetRadius * cosLinkAngle;
      const offsetTargetY = target.y! - offsetTargetRadius * sinLinkAngle;

      this.drawWithAlpha(() => {
        this.strokeWithColor(() => {
          this.canvasCtx.moveTo(offsetSourceX, offsetSourceY);
          this.canvasCtx.lineTo(offsetTargetX, offsetTargetY);
        }, '#999999');
        this.drawLinkArrow(target, linkAngle, sinLinkAngle, cosLinkAngle);
      }, isSelected ? 1 : this.canvasAlpha, link);
    }

    drawLinkArrow(target: NodeDatum, linkAngle: number, sinLinkAngle: number, cosLinkAngle: number) {
      const linkAngle2 = this.PI_HALF - linkAngle;
      const sinLinkAngle2 = Math.sin(linkAngle2);
      const tanLinkAngle2 = Math.tan(linkAngle2);

      const length = this.linkArrowLengthCos - this.linkArrowLengthSin / tanLinkAngle2;
      const offsetX1 = length * cosLinkAngle;
      const offsetY1 = this.linkArrowLengthSin / sinLinkAngle2 + length * sinLinkAngle;

      const offsetX2 = offsetX1 + this.linkArrowLengthSin2 * sinLinkAngle;
      const offsetY2 = offsetY1 - this.linkArrowLengthSin2 * cosLinkAngle;

      const offsetTargetX = target.x! - target.radius * cosLinkAngle;
      const offsetTargetY = target.y! - target.radius * sinLinkAngle;

      this.fillWithColor(() => {
        this.canvasCtx.moveTo(offsetTargetX, offsetTargetY);
        this.canvasCtx.lineTo(offsetTargetX - offsetX1, offsetTargetY - offsetY1);
        this.canvasCtx.lineTo(offsetTargetX - offsetX2, offsetTargetY - offsetY2);
      }, '#ff0000');
    }

    drawNode(node: NodeDatum) {
      let isTransparent = false;
      let innerRadius = 0;

      const isNearby = (isNearby: boolean) => {
        if (isNearby) {
          innerRadius = node.radius / 2;
          return;
        }
        isTransparent = true;
        innerRadius = node.radius - 2;
      };
      if (this.isSelectedNode) {
        if (node.index !== this.selectedNode.index) {
          isNearby(this.selectedLinkCount.flat().includes(node.id));
        }
      } else if (this.isSelectedLink) {
        isNearby(this.selectedLinkNodeIndices.includes(node.index));
      }

      if (!node.innerRadius) {
        node.innerRadius = 0;
      }
      if (node.innerRadius !== innerRadius) {
        innerRadius = d3.interpolate(node.innerRadius, innerRadius)(this.interpolate);
        if (this.interpolate > 0) {
          node.innerRadius = innerRadius;
        }
      }

      if (node.radius > 0) {
        const text = node.name;
        const textX = node.x!;
        const textY = node.y! + node.radius + 12;
        if (text) {
          this.drawWithAlpha(() => {
            this.canvasCtx.strokeStyle = '#ffffff';
            this.canvasCtx.strokeText(text, textX, textY);
          }, 1);
        }

        this.drawWithAlpha(() => {
          const tagCount = node.tags.length;
          const count = tagCount || 1;
          const perAngle = this.PI_2 / count;
          let startAngle = -perAngle;
          let endAngle = 0;
          for (let i = 0; i < count; i++) {
            this.fillWithColor(() => {
              this.canvasCtx.arc(node.x!, node.y!, node.radius, startAngle += perAngle, endAngle += perAngle);
              if (count > 1) {
                this.canvasCtx.lineTo(node.x!, node.y!);
              }
            }, strToRGB(tagCount > 0 ? node.tags[i] : 'Untagged'));
          }

          if (text) {
            this.canvasCtx.fillStyle = '#424242';
            this.canvasCtx.fillText(text, textX, textY);
          }
        }, isTransparent ? this.canvasAlpha : 1, node);
      }

      if (innerRadius > 0) {
        this.drawWithAlpha(() => {
          this.fillWithColor(() => {
            this.canvasCtx.arc(node.x!, node.y!, innerRadius, 0, this.PI_2);
          }, '#ffffff');
        }, 1);
      }
    }

    strokeWithColor(stroke: () => void, color: string) {
      this.canvasCtx.strokeStyle = color;
      this.canvasCtx.beginPath();
      stroke();
      this.canvasCtx.stroke();
    }

    fillWithColor(fill: () => void, color: string) {
      this.canvasCtx.fillStyle = color;
      this.canvasCtx.beginPath();
      fill();
      this.canvasCtx.fill();
    }

    drawWithAlpha(draw: () => void, alpha: number, nodeOrLink?: NodeDatum | LinkDatum) {
      if (!nodeOrLink) {
        this.canvasCtx.globalAlpha = alpha;
        draw();
        return;
      }
      if (!nodeOrLink.alpha) {
        nodeOrLink.alpha = this.canvasAlpha;
      }
      if (nodeOrLink.alpha !== alpha) {
        alpha = d3.interpolate(nodeOrLink.alpha, alpha)(this.interpolate);
        if (this.interpolate > 0) {
          nodeOrLink.alpha = alpha;
        }
      }
      this.canvasCtx.globalAlpha = alpha;
      draw();
    }

    increaseInterpolate() {
      let interpolate = this.interpolate;
      if (interpolate >= 1) {
        return;
      }
      interpolate += 0.05;
      this.interpolate = interpolate > 1 ? 1 : interpolate;
    }

    dragSubject() {
      const node = this.findCurrentNode();
      if (node) {
        return node;
      }
      const link = this.findCurrentLink();
      if (link) {
        return link;
      }
      this.selectedNodeOrLink = null;
    }

    dragStarted() {
      if (!d3.event.active) {
        this.restartSimulationWithAlpha(true);
      }
      this.selectedNodeOrLink = d3.event.subject;
      this.dragged();
    }

    dragged() {
      const [x, y] = this.getCanvasXY();
      if (this.isSelectedNode) {
        this.selectedNode.fx = x;
        this.selectedNode.fy = y;
        return;
      }
      if (!this.isSelectedLink) {
        return;
      }
      if (!this.draggedLinkSourceOffsetXY) {
        this.draggedLinkSourceOffsetXY = [this.selectedLink.source.x! - x, this.selectedLink.source.y! - y];
      }
      if (!this.draggedLinkTargetOffsetXY) {
        this.draggedLinkTargetOffsetXY = [this.selectedLink.target.x! - x, this.selectedLink.target.y! - y];
      }
      this.selectedLink.source.fx = x + this.draggedLinkSourceOffsetXY[0];
      this.selectedLink.source.fy = y + this.draggedLinkSourceOffsetXY[1];
      this.selectedLink.target.fx = x + this.draggedLinkTargetOffsetXY[0];
      this.selectedLink.target.fy = y + this.draggedLinkTargetOffsetXY[1];
    }

    dragEnded() {
      if (!d3.event.active) {
        this.resetSimulationAlphaTarget();
      }
      if (this.isSelectedNode) {
        this.selectedNode.fx = null;
        this.selectedNode.fy = null;
        return;
      }
      if (!this.isSelectedLink) {
        return;
      }
      this.selectedLink.source.fx = null;
      this.selectedLink.source.fy = null;
      this.selectedLink.target.fx = null;
      this.selectedLink.target.fy = null;
      this.draggedLinkSourceOffsetXY = null;
      this.draggedLinkTargetOffsetXY = null;
    }

    zoomed() {
      this.canvasNoTransXY = this.getCanvasNoTransXY();
      this.transform = d3.event.transform;
      this.ticked();
    }

    mouseMoved() {
      this.canvasNoTransXY = this.getCanvasNoTransXY();
      const node = this.findCurrentNode();
      this.canvasCtx.canvas.title = node ? node.id : '';
    }

    addNode(path: string, title: string, tags?: string[]) {
      this.linkCount[path] = [[], []];
      const node: NodeDatum = {
        x: this.width / 2,
        y: this.height / 2,
        id: path,
        name: title,
        tags: tags || [],
        radius: this.nodeMinRadius,
      };
      this.nodes.push(node);
      this.reloadNode();
      this.restartSimulationWithAlpha();
      return node;
    }

    addLink(source: NodeDatum, target: NodeDatum) {
      if (source.index === target.index) {
        return;
      }
      const sourceLinkCount = this.linkCount[source.id];
      const targetLinkCount = this.linkCount[target.id];
      if (sourceLinkCount[1].includes(target.id)) {
        return;
      }
      sourceLinkCount[1].push(target.id);
      targetLinkCount[0].push(source.id);
      this.links.push({ source, target } as LinkDatum);
      this.increaseRadius(target);
      this.interpolate = 0;
      this.reloadLink();
      this.restartSimulationWithAlpha();
    }

    reloadNode() {
      this.simulation.nodes(this.nodes);
    }

    reloadLink() {
      this.simulation.force<ForceLink<NodeDatum, LinkDatum>>('link')!.links(this.links);
    }

    increaseRadius(node: NodeDatum, value = this.nodeRadiusUnit) {
      let radius = node.radius;
      if (radius >= this.nodeMaxRadius) {
        return;
      }
      radius += value;
      if (radius > this.nodeMaxRadius) {
        radius = this.nodeMaxRadius;
      }
      node.radius = radius;
      this.forceCollide(true);
      this.restartSimulationWithAlpha();
    }

    restartSimulationWithAlpha(isTarget = false, alpha = 0.3) {
      if (isTarget) {
        this.resetSimulationAlphaTarget(alpha);
        this.simulation.restart();
        return;
      }
      this.simulation.alpha(alpha);
      this.simulation.restart();
    }

    resetSimulationAlphaTarget(alpha = 0) {
      this.simulation.alphaTarget(alpha);
    }

    getCanvasXY() {
      const [x, y] = this.getCanvasNoTransXY();
      return this.transformXY(x, y);
    }

    getCanvasNoTransXY() {
      return d3.mouse(this.canvasCtx.canvas);
    }

    transformXY(x: number, y: number): [number, number] {
      return [this.transform.invertX(x), this.transform.invertY(y)];
    }

    findNode(x: number, y: number) {
      for (let i = this.nodes.length - 1; i >= 0; --i) {
        const node = this.nodes[i];
        const dx = x - node.x!;
        if (dx > node.radius || dx < -node.radius) {
          continue;
        }
        const dy = y - node.y!;
        if (dy > node.radius || dy < -node.radius) {
          continue;
        }
        const distSqr = dx * dx + dy * dy;
        const radiusSqr = node.radius * node.radius;
        if (distSqr <= radiusSqr) {
          return node;
        }
      }
      return null;
    }

    findCurrentNode() {
      const [x, y] = this.canvasXY;
      return this.findNode(x, y);
    }

    findLink(x: number, y: number) {
      for (let i = this.links.length - 1; i >= 0; --i) {
        const link = this.links[i];
        const [minX, maxX] = [link.source.x!, link.target.x!].sort((a, b) => a - b);
        const offsetX = maxX - minX < this.linkWidth ? this.halfLinkWidth : 0;
        if (x > maxX + offsetX || x < minX - offsetX) {
          continue;
        }
        const [minY, maxY] = [link.source.y!, link.target.y!].sort((a, b) => a - b);
        const offsetY = maxY - minY < this.linkWidth ? this.halfLinkWidth : 0;
        if (y > maxY + offsetY || y < minY - offsetY) {
          continue;
        }
        const angle = Math.atan2(link.target.y! - link.source.y!, link.target.x! - link.source.x!);
        const angle2 = angle - this.PI_HALF;
        const k1 = Math.tan(angle2);
        const eq1 = k1 * (x - link.source.x!) - y + link.source.y!;
        const eq2 = k1 * (x - link.target.x!) - y + link.target.y!;
        if (eq1 < 0 === eq2 < 0) {
          continue;
        }
        const k2 = Math.tan(angle);
        const eq = k2 * (x - link.source.x!) - y + link.source.y!;
        const b = this.halfLinkWidth / Math.sin(angle2);
        const eq3 = eq + b;
        const eq4 = eq - b;
        if (eq3 < 0 !== eq4 < 0) {
          return link;
        }
      }
      return null;
    }

    findCurrentLink() {
      const [x, y] = this.canvasXY;
      return this.findLink(x, y);
    }
  }
</script>

<style lang="scss" scoped>@import "../styles/graph";</style>
