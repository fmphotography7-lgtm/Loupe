
window.SFRoomProjects = {
  async thumbnail(project){
    const sf=window.SF;
    const scene=sf.state.scenes.find(s=>s.id===project.sceneId);
    const art=sf.state.artworks.find(a=>a.id===project.artworkId);
    return scene?.image||art?.image||'';
  },

  render(){
    const sf=window.SF;
    sf.$('workspace').innerHTML=`
      <div class="card">
        <div class="toolbar">
          <div><h2 style="margin:0">Saved Room Projects</h2><small style="color:var(--muted)">Open, edit, rename, duplicate or delete saved room designs.</small></div>
          <button class="button primary" id="newRoomProject">New Room Project</button>
        </div>
        <div class="project-grid">
          ${(sf.state.roomProjects||[]).map(project=>{
            const scene=sf.state.scenes.find(s=>s.id===project.sceneId);
            const art=sf.state.artworks.find(a=>a.id===project.artworkId);
            const thumb=scene?.image||art?.image||'';
            return `<div class="project-card">
              <div class="project-thumb">${thumb?`<img src="${thumb}">`:'No preview available'}</div>
              <div class="card-copy">
                <b>${sf.esc(project.name)}</b>
                <small>${sf.esc(art?.title||'Missing artwork')} · ${sf.esc(scene?.name||'Missing scene')}</small>
                <div class="row-actions">
                  <button class="button primary open-project" data-id="${project.id}">Open & Edit</button>
                  <button class="button secondary rename-project" data-id="${project.id}">Rename</button>
                  <button class="button secondary duplicate-project" data-id="${project.id}">Duplicate</button>
                  <button class="button danger delete-project" data-id="${project.id}">Delete</button>
                </div>
              </div>
            </div>`;
          }).join('')||'<div class="empty">No saved room projects yet.</div>'}
        </div>
      </div>`;

    sf.$('newRoomProject').addEventListener('click',()=>sf.goTo('Room Designer'));
    document.querySelectorAll('.open-project').forEach(b=>b.addEventListener('click',()=>this.open(b.dataset.id)));
    document.querySelectorAll('.rename-project').forEach(b=>b.addEventListener('click',()=>this.rename(b.dataset.id)));
    document.querySelectorAll('.duplicate-project').forEach(b=>b.addEventListener('click',()=>this.duplicate(b.dataset.id)));
    document.querySelectorAll('.delete-project').forEach(b=>b.addEventListener('click',()=>this.delete(b.dataset.id)));
  },

  open(id){
    const sf=window.SF;
    const project=sf.state.roomProjects.find(p=>p.id===id);
    if(!project)return;
    window.SFRoomDesigner.model={
      ...window.SFRoomDesigner.model,
      ...JSON.parse(JSON.stringify(project.settings||{})),
      projectId:project.id,
      artworkId:project.artworkId,
      sceneId:project.sceneId,
      undo:[],
      redo:[]
    };
    sf.goTo('Room Designer');
  },

  async rename(id){
    const sf=window.SF,project=sf.state.roomProjects.find(p=>p.id===id);
    if(!project)return;
    /* g147: was prompt(), which Electron does not implement — rename did nothing. */
    const name=await sf.askText('Rename this room project','Project name',project.name,'','');
    if(!name)return;
    project.name=name.trim();
    project.updatedAt=new Date().toISOString();
    sf.logActivity(`Renamed room project: ${project.name}`);
    await sf.persist();this.render();
  },

  async duplicate(id){
    const sf=window.SF,project=sf.state.roomProjects.find(p=>p.id===id);
    if(!project)return;
    const copy=JSON.parse(JSON.stringify(project));
    copy.id=sf.makeId('ROOM');
    copy.name=`${project.name} Copy`;
    copy.createdAt=new Date().toISOString();
    copy.updatedAt=copy.createdAt;
    sf.state.roomProjects.push(copy);
    sf.logActivity(`Duplicated room project: ${project.name}`);
    await sf.persist();this.render();
  },

  async delete(id){
    const sf=window.SF,project=sf.state.roomProjects.find(p=>p.id===id);
    if(!project||!confirm(`Delete "${project.name}"?`))return;
    sf.state.roomProjects=sf.state.roomProjects.filter(p=>p.id!==id);
    sf.logActivity(`Deleted room project: ${project.name}`);
    await sf.persist();this.render();
  }
};
