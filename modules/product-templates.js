window.SFProductTemplates={
  normalizeMedium(name){
    const raw=String(name||'').trim(); const key=raw.toLowerCase().replace(/[^a-z0-9]+/g,' ');
    if(key.includes('metallic')&&key.includes('luster'))return {id:'metallic',name:'Metallic Luster'};
    if(key.includes('luster'))return {id:'luster',name:'Luster Paper'};
    if(key.includes('canvas'))return {id:'canvas',name:'Canvas'};
    if(key.includes('metal'))return {id:'metal',name:'Metal'};
    if(key.includes('card'))return {id:'cards',name:'Art Card'};
    const id=key.replace(/\s+/g,'-')||'unspecified'; return {id,name:raw||'Unspecified'};
  },
  sizeParts(size){const m=String(size||'').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);return m?[Number(m[1]),Number(m[2])]:[9999,9999];},
  sortSizes(sizes){return [...new Set(sizes.filter(Boolean))].sort((a,b)=>{const A=this.sizeParts(a),B=this.sizeParts(b);return (A[0]*A[1]-B[0]*B[1])||(A[0]-B[0])||String(a).localeCompare(String(b));});},
  defaults(){return [
    {id:'canvas',name:'Canvas',sizes:[],enabled:true},
    {id:'metal',name:'Metal',sizes:[],enabled:true},
    {id:'luster',name:'Luster Paper',sizes:[],enabled:true},
    {id:'metallic',name:'Metallic Luster',sizes:[],enabled:true},
    {id:'cards',name:'Art Card',sizes:[],enabled:true}
  ];},
  ensure(state){if(!Array.isArray(state.productTemplates)||!state.productTemplates.length)state.productTemplates=this.defaults();return state.productTemplates;},
  mergeObserved(state,observed){
    const current=this.ensure(state),map=new Map(current.map(t=>[t.id,t]));
    for(const [id,item] of Object.entries(observed||{})){
      const t=map.get(id)||{id,name:item.name||id,sizes:[],enabled:true};
      t.name=item.name||t.name;t.sizes=this.sortSizes([...(t.sizes||[]),...(item.sizes||[])]);map.set(id,t);
    }
    const order=['canvas','metal','luster','metallic','cards'];
    state.productTemplates=[...map.values()].sort((a,b)=>(order.indexOf(a.id)<0?99:order.indexOf(a.id))-(order.indexOf(b.id)<0?99:order.indexOf(b.id))||a.name.localeCompare(b.name));
    return state.productTemplates;
  },
  byName(name){const n=this.normalizeMedium(name);return this.ensure(window.SF.state).find(t=>t.id===n.id);}
};
