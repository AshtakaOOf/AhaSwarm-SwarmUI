// SwarmUI login page: adds a "Log in to AhaSwarm" toggle under the login button
(function () {
    const KEY = 'ahaswarm.loginToAha';
    function init() {
        let button = document.getElementById('login_button');
        if (!button || document.getElementById('ahaswarm_login_toggle')) {
            return;
        }
        let row = document.createElement('div');
        row.className = 'login-input-block';
        let label = document.createElement('label');
        label.style.cssText = 'display: inline-flex; align-items: center; gap: 0.5em; cursor: pointer; user-select: none;';
        let box = document.createElement('input');
        box.type = 'checkbox';
        box.id = 'ahaswarm_login_toggle';
        box.checked = localStorage.getItem(KEY) === 'true';
        box.addEventListener('change', () => localStorage.setItem(KEY, `${box.checked}`));
        label.append(box, document.createTextNode('Log in to AhaSwarm'));
        row.appendChild(label);
        button.closest('.login-input-block').after(row);
        let send = window.sendJsonToServer;
        if (typeof send !== 'function') {
            return;
        }
        window.sendJsonToServer = function (url, data, callback, ...rest) {
            if (url === 'API/Login' && typeof callback === 'function') {
                let inner = callback;
                callback = function (status, result) {
                    if (result && result.success && box.checked) {
                        window.location.href = 'Aha/';
                        return;
                    }
                    return inner.apply(this, arguments);
                };
            }
            return send.call(this, url, data, callback, ...rest);
        };
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    }
    else {
        init();
    }
})();
