/** Production comment/editor components, native host UI, synthetic data/transport.
 * Owner seam uses the parent-accepted pre-filter numbering interface. */
import { createElement as h, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { RichEditor } from '../../frontend/rich-editor.jsx';
import { Comments } from '../../frontend/comments.jsx';
import { numberComments } from '../../frontend/comment-highlights.jsx';
import { commentAnchor } from '../../frontend/editor.mjs';
import { styles } from '../../frontend/styles.mjs';
import { nousTheme } from '@/themes/presets';
// Apply only the pinned host palette seeds to this isolated fixture, never a real profile.
function theme(mode){
 const root=document.documentElement,c=mode==='dark'?nousTheme.darkColors:nousTheme.colors;
 root.classList.toggle('dark',mode==='dark');root.style.colorScheme=mode;
 const values={'--theme-foreground':c.foreground,'--theme-primary':c.primary,'--theme-secondary':c.secondary,'--theme-accent-soft':c.accent,'--theme-midground':c.midground??c.ring,'--theme-warm':c.primary,'--theme-background-seed':c.background,'--theme-sidebar-seed':c.sidebarBackground??c.background,'--theme-card-seed':c.card,'--theme-elevated-seed':c.popover,'--theme-bubble-seed':c.userBubble??c.popover,'--dt-primary-foreground':c.primaryForeground,'--dt-secondary-foreground':c.secondaryForeground,'--dt-accent-foreground':c.accentForeground,'--dt-border':c.border,'--dt-input':c.input,'--dt-ring':c.ring,'--dt-muted':c.muted};
 for(const [key,value] of Object.entries(values))root.style.setProperty(key,value);
}
theme(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
const page={id:'synthetic-page',kind:'page',title:'River garden notes',content:'<h2>Review the river garden</h2><p>North river path stays shaded through the morning. Keep the river clear.</p><p>South river path needs careful drainage.</p><p>Meadow beds will be planted in spring.</p>'+Array.from({length:14},(_,i)=>`<p>Field note ${i+1}: keep the surrounding garden observations unchanged.</p>`).join('')};
const database={...page,id:'synthetic-database',kind:'database',title:'Garden observations'};
const initial=[
 {id:'first',item_id:page.id,text:'Clarify the morning route.',anchor:{quote:'North river path'},resolved:false,replies:[{id:'reply-a',author:'agent',text:'Earlier reply; the user has not resolved this feedback.'}]},
 {id:'overlap',item_id:page.id,text:'Keep this overlapping request independent.',anchor:{quote:'river path',prefix:'Review the river gardenNorth '},resolved:false,replies:[]},
 {id:'second',item_id:page.id,text:'Check the southern drainage.',anchor:{quote:'South river path'},resolved:false,replies:[]},
 {id:'missing',item_id:page.id,text:'Recover the removed bridge note.',anchor:{quote:'Original bridge location'},resolved:false,replies:[]},
 {id:'ambiguous',item_id:page.id,text:'Choose which river path was intended.',anchor:{quote:'river path'},resolved:false,replies:[]},
 {id:'whole',item_id:page.id,text:'Review the whole page without widening any passage.',anchor:null,resolved:false,replies:[]},
 {id:'resolved',item_id:page.id,text:'Previously resolved meadow feedback.',anchor:{quote:'Meadow beds'},resolved:true,replies:[]},
 {id:'db',item_id:database.id,text:'Database-wide feedback only.',anchor:null,resolved:false,replies:[]},
];
const evidence={calls:[],errors:[],draft:null};
let controls;
function Fixture(){
 const [comments,setComments]=useState(initial),[active,setActive]=useState('first'),[hovered,setHovered]=useState(null),[showResolved,setShowResolved]=useState(false),[anchor,setAnchor]=useState(null),[geometry,setGeometry]=useState([]),[text,setText]=useState(''),[locked,setLocked]=useState(false),[item,setItem]=useState(page),[html,setHTML]=useState(page.content);
 const editorFocus=useRef(null);
 const numbered=numberComments(comments.filter(c=>c.item_id===item.id)).map(c=>({...c,anchor:commentAnchor(c)}));
 const visible=numbered.filter(c=>showResolved||!c.resolved);
 const passage=(id,anchor)=>{setActive(id);editorFocus.current?.(anchor)};
 const reveal=id=>{window.getSelection()?.removeAllRanges();setActive(id);requestAnimationFrame(()=>document.getElementById('ws-discussion-'+id)?.focus({preventScroll:true}));};
 controls={setLocked,setShowResolved,setItem:kind=>{setActive(null);setGeometry([]);setItem(kind==='database'?database:page)},edit:content=>{setHTML(content)},snapshot:()=>({comments,active,hovered,showResolved,locked,item:item.id,text,html,...evidence})};
 const command=async(name,args)=>{evidence.calls.push({name,args:structuredClone(args)});if(locked)throw Error('Synthetic lock');if(name==='resolve_comment')setComments(all=>all.map(c=>c.id===args.id?{...c,resolved:args.resolved}:c));if(name==='delete_comment')setComments(all=>all.filter(c=>c.id!==args.id));if(name==='reply_comment')setComments(all=>all.map(c=>c.id===args.id?{...c,replies:[...c.replies,{id:'user-reply-'+evidence.calls.length,author:'user',text:args.text}]}:c));if(name==='add_comment')setComments(all=>[...all,{id:'new-'+evidence.calls.length,item_id:args.item_id,text:args.text,anchor:args.anchor??null,replies:[],resolved:false}])};
 return h('main',{className:'ws-root',style:{height:'100vh'}},h('style',null,styles),h('div',{className:'ws-work',style:{width:'100%',height:'100%',overflow:'auto'}},h('div',{className:'ws-layout'},h('div',{className:'ws-document'},h('header',{className:'ws-document-header'},h('h1',null,item.title)),h('div',{className:'ws-comment-controls-slot'}),item.kind==='database'?h('p',null,'Synthetic database surface — comments are whole-item only.'):h(RichEditor,{key:item.id,item:{...item,content:html},locked,onSave:async value=>setHTML(value),onText:setText,onError:e=>evidence.errors.push(e.message),onAnchor:setAnchor,onLink:()=>{},attachments:[],comments:visible,activeComment:active,hoveredComment:hovered,onCommentHover:setHovered,onCommentGeometry:setGeometry,pendingAnchor:anchor,onComment:reveal,registerFocus:fn=>{editorFocus.current=fn},registerFlush:()=>()=>{}})),h(Comments,{key:item.id,item,state:{items:[page,database],comments},text,anchor,setAnchor,activeComment:active,setActiveComment:setActive,geometry,hoveredComment:hovered,setHoveredComment:setHovered,showResolved,setShowResolved,onPassage:passage,returnToEditor:()=>editorFocus.current?.(),command,workflow:{},locked,onError:e=>evidence.errors.push(e.message),onRun:()=>{},onRefresh:()=>{},draftBuffer:{read:()=>evidence.draft,put:draft=>{evidence.draft={draft}},discard:()=>{evidence.draft=null}}}))));
}
window.issue8={theme,snapshot:()=>controls.snapshot(),lock:value=>controls.setLocked(value),showResolved:value=>controls.setShowResolved(value),item:kind=>controls.setItem(kind),edit:html=>controls.edit(html)};
createRoot(document.getElementById('app')).render(h(Fixture));
