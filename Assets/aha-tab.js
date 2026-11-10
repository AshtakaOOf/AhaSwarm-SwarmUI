(function () {
    function injectTab() {
        let tabList = document.getElementById('toptablist');
        if (!tabList || document.getElementById('ahaswarm_toptab')) {
            return;
        }
        let li = document.createElement('li');
        li.className = 'nav-item';
        li.setAttribute('role', 'presentation');
        li.id = 'ahaswarm_toptab';
        let a = document.createElement('a');
        a.className = 'nav-link';
        a.href = 'Aha/';
        a.title = 'Open the AhaSwarm frontend';
        a.textContent = 'AhaSwarm ↗';
        li.appendChild(a);
        tabList.appendChild(li);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectTab);
    }
    else {
        injectTab();
    }
})();
