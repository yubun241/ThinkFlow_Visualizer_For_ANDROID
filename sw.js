<script>

// =============================
// 状態管理
// =============================
const State = {
    nodes: [],
    connections: [],
    categories: JSON.parse(localStorage.getItem("cats")) || {
        "資産・実績":"#3b82f6",
        "現実・制約":"#94a3b8"
    },
    selectedNode: null,
    undoStack: []
};

// DOM参照
const canvas = document.getElementById("canvas");
const input = document.getElementById("input");
const mode = document.getElementById("mode");
const category = document.getElementById("category");

// =============================
// 初期化
// =============================
window.onload = () => {
    UI.refreshCategory();
    Storage.load();
};

// =============================
// UI管理
// =============================
const UI = {

    refreshCategory() {
        category.innerHTML = "";
        Object.entries(State.categories).forEach(([name]) => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.innerText = name;
            category.appendChild(opt);
        });
    }

};

// =============================
// カテゴリ
// =============================
function addCategory(){
    const name = newCat.value.trim();
    const color = catColor.value;

    if(!name) return;

    State.categories[name] = color;
    localStorage.setItem("cats", JSON.stringify(State.categories));
    UI.refreshCategory();
}

// =============================
// ノード作成
// =============================
function createNode(data=null){

    const text = data?.text || input.value.trim();
    if(!text) return;

    History.push();

    const node = document.createElement("div");
    const id = data?.id || `n_${Date.now()}`;

    node.className = "node";
    node.id = id;
    node.style.left = data?.left || "100px";
    node.style.top = data?.top || "100px";

    const modeVal = data?.mode || mode.value;

    if(modeVal === "box"){
        const cat = data?.cat || category.value;
        const color = State.categories[cat];

        node.classList.add("node-box");
        node.style.borderColor = color;

        node.innerHTML = `
            <div style="font-size:10px">${cat}</div>
            <div>${text}</div>
        `;

        node.dataset.cat = cat;

    } else {
        node.classList.add("node-text");
        node.innerText = text;
    }

    node.dataset.mode = modeVal;

    Node.init(node);

    canvas.appendChild(node);
    State.nodes.push({ id, el: node });

    Storage.save();
}

// =============================
// ノード操作
// =============================
const Node = {

    init(node){
        this.enableDrag(node);
        this.enableResize(node);
        this.enableLongPressDelete(node);
        this.enableSelectConnect(node);
    },

    enableDrag(node){
        node.addEventListener("pointerdown", (e)=>{
            if(e.target.classList.contains("resizer")) return;

            const offsetX = e.offsetX;
            const offsetY = e.offsetY;

            const move = (me)=>{
                node.style.left = `${me.clientX - offsetX}px`;
                node.style.top  = `${me.clientY - offsetY}px`;
                Connection.update(node.id);
            };

            const up = ()=>{
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                Storage.save();
            };

            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
        });
    },

    enableResize(node){
        const handle = document.createElement("div");
        handle.className = "resizer";
        node.appendChild(handle);

        handle.addEventListener("pointerdown", (e)=>{
            e.stopPropagation();

            let startX = e.clientX;
            let startY = e.clientY;
            let startW = node.offsetWidth;
            let startH = node.offsetHeight;

            const move = (me)=>{
                node.style.width  = `${startW + me.clientX - startX}px`;
                node.style.height = `${startH + me.clientY - startY}px`;
                Connection.update(node.id);
            };

            const up = ()=>{
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                Storage.save();
            };

            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
        });
    },

    enableLongPressDelete(node){
        let timer;

        node.addEventListener("pointerdown", ()=>{
            timer = setTimeout(()=> {
                Node.remove(node.id);
            }, 700);
        });

        node.addEventListener("pointerup", ()=> clearTimeout(timer));
        node.addEventListener("pointermove", ()=> clearTimeout(timer));
    },

    enableSelectConnect(node){
        node.addEventListener("click", (e)=>{
            e.stopPropagation();

            if(!State.selectedNode){
                State.selectedNode = node.id;
                node.style.outline = "3px solid red";
                return;
            }

            Connection.create(State.selectedNode, node.id);

            document.getElementById(State.selectedNode).style.outline = "none";
            State.selectedNode = null;
        });
    },

    remove(id){
        document.getElementById(id)?.remove();

        State.connections = State.connections.filter(c=>{
            if(c.a === id || c.b === id){
                c.line.remove();
                return false;
            }
            return true;
        });

        State.nodes = State.nodes.filter(n=>n.id !== id);
        Storage.save();
    }

};

// =============================
// 接続管理
// =============================
const Connection = {

    create(a, b){
        const line = new LeaderLine(
            document.getElementById(a),
            document.getElementById(b),
            { color:"#6366f1", size:3 }
        );

        line.path.onclick = ()=>{
            line.remove();
            State.connections = State.connections.filter(c=>c.line !== line);
            Storage.save();
        };

        State.connections.push({ a, b, line });
    },

    update(id){
        State.connections.forEach(c=>{
            if(c.a === id || c.b === id){
                c.line.position();
            }
        });
    }

};

// =============================
// 保存 / 読込
// =============================
const Storage = {

    save(){
        const data = {
            nodes: State.nodes.map(n=>({
                id: n.id,
                text: n.el.innerText,
                left: n.el.style.left,
                top: n.el.style.top,
                mode: n.el.dataset.mode,
                cat: n.el.dataset.cat
            })),
            connections: State.connections.map(c=>({a:c.a,b:c.b}))
        };
        localStorage.setItem("tf", JSON.stringify(data));
    },

    load(){
        const data = JSON.parse(localStorage.getItem("tf"));
        if(!data) return;

        data.nodes.forEach(n=>createNode(n));
        data.connections.forEach(c=>Connection.create(c.a, c.b));
    }

};

// =============================
// 履歴管理
// =============================
const History = {

    push(){
        State.undoStack.push(localStorage.getItem("tf"));
    },

    undo(){
        if(!State.undoStack.length) return;

        localStorage.setItem("tf", State.undoStack.pop());
        location.reload();
    }

};

// =============================
// 外部操作
// =============================
function undo(){ History.undo(); }

function clearAll(){
    if(!confirm("全削除しますか？")) return;
    localStorage.clear();
    location.reload();
}

function downloadData(){
    const blob = new Blob([localStorage.getItem("tf")]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.json";
    a.click();
}

function importData(){
    const input = document.createElement("input");
    input.type = "file";

    input.onchange = e=>{
        const reader = new FileReader();
        reader.onload = r=>{
            localStorage.setItem("tf", r.target.result);
            location.reload();
        };
        reader.readAsText(e.target.files[0]);
    };

    input.click();
}

async function exportPDF(){
    const canvasEl = await html2canvas(canvas);
    const pdf = new jspdf.jsPDF("l","mm","a4");
    pdf.addImage(canvasEl.toDataURL(),"PNG",0,0,297,150);
    pdf.save("thinkflow.pdf");
}

</script>
