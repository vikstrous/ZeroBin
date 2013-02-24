/**
 * ZeroBin
 *
 * a zero-knowledge paste bin
 *
 * @link      http://sebsauvage.net/wiki/doku.php?id=php:zerobin
 * @copyright 2012 Sébastien SAUVAGE (sebsauvage.net)
 * @license   http://www.opensource.org/licenses/zlib-license.php The zlib/libpng License
 * @version   0.3
 */

// Immediately start random number generator collector.
sjcl.random.startCollectors();

// Change template strings for underscore templating
_.templateSettings = {
  evaluate : /\{\{\!([\s\S]+?)\}\}/g,
  interpolate : /\{\{\{([\s\S]+?)\}\}\}/g,
  escape : /\{\{(?!\{)(?!\!)([\s\S]+?)\}\}/g
};

var util = {

    /**
     *  Converts a duration (in seconds) into human readable format.
     *
     *  @param int seconds
     *  @return string
     */
    secondsToHuman: function (seconds)
    {
        var v;
        if (seconds<60) { v=Math.floor(seconds); return v+' second'+((v>1)?'s':''); }
        if (seconds<60*60) { v=Math.floor(seconds/60); return v+' minute'+((v>1)?'s':''); }
        if (seconds<60*60*24) { v=Math.floor(seconds/(60*60)); return v+' hour'+((v>1)?'s':''); }
        if (seconds<60*60*24*60) { v=Math.floor(seconds/(60*60*24)); return v+' day'+((v>1)?'s':''); }
        v=Math.floor(seconds/(60*60*24*30)); return v+' month'+((v>1)?'s':'');
    },

    /**
     * Compress, then encrypt message with key.
     *
     * @param string key
     * @param string message
     * @return encrypted string data
     */
    zeroCipher: function (key, message) {
        return sjcl.encrypt(key, RawDeflate.deflate( Base64.utob(message) ) );
    },

    /**
     *  Decrypt message with key, then decompress.
     *
     *  @param key
     *  @param encrypted string data
     *  @return string readable message
     */
    zeroDecipher: function (key, data) {
        return Base64.btou( RawDeflate.inflate( sjcl.decrypt(key, data) ) );
    },

    /**
     * @return the current script location (without search or hash part of the URL).
     *   eg. http://server.com/zero/?aaaa#bbbb --> http://server.com/zero/
     */
    scriptLocation: function () {
        if (globalState.get('remote')) {
            return globalState.get('server');
        } else {
            return window.location.href.substring(0, window.location.href.length -
                     window.location.search.length - window.location.hash.length - 1);
        }
    },
    /**
     * Set text of a DOM element (required for IE)
     * This is equivalent to element.text(text)
     * @param object element : a DOM element.
     * @param string text : the text to enter.
     */
    setElementText: function (element, text) {
        // For IE<10.
        if ($('div#oldienotice').is(":visible")) {
            // IE<10 do not support white-space:pre-wrap; so we have to do this BIG UGLY STINKING THING.
            element.text(text.replace(/\n/ig,'{BIG_UGLY_STINKING_THING__OH_GOD_I_HATE_IE}'));
            element.html(element.text().replace(/{BIG_UGLY_STINKING_THING__OH_GOD_I_HATE_IE}/ig,"\n<br />"));
        }
        // for other (sane) browsers:
        else {
            element.text(text);
        }
    },

    // Some stupid web 2.0 services and redirectors add data AFTER the anchor
    // (such as &utm_source=...).
    // We will strip any additional data.
    cleanKey: function (key) {
        // First, strip everything after the equal sign (=) which signals end of base64 string.
        i = key.indexOf('='); if (i>-1) { key = key.substring(0,i+1); }

        // If the equal sign was not present, some parameters may remain:
        i = key.indexOf('&'); if (i>-1) { key = key.substring(0,i); }

        // Then add trailing equal sign if it's missing
        if (key.charAt(key.length-1)!=='=') key+='=';

        return key;
    },

    /**
     * Convert URLs to clickable links.
     * URLs to handle:
     * <code>
     *     magnet:?xt.1=urn:sha1:YNCKHTQCWBTRNJIV4WNAE52SJUQCZO5C&xt.2=urn:sha1:TXGCZQTH26NL6OUQAJJPFALHG2LTGBC7
     *     http://localhost:8800/zero/?6f09182b8ea51997#WtLEUO5Epj9UHAV9JFs+6pUQZp13TuspAUjnF+iM+dM=
     *     http://user:password@localhost:8800/zero/?6f09182b8ea51997#WtLEUO5Epj9UHAV9JFs+6pUQZp13TuspAUjnF+iM+dM=
     * </code>
     *
     * @param object element : a jQuery DOM element.
     * @FIXME: add ppa & apt links.
     */
    urls2links: function (element) {
        return $(element).map(function (i, elm) {
            elm = $(elm);
            if(elm.html() !== null){
                var re = /((http|https|ftp):\/\/[\w?=&.\/-;#@~%+-]+(?![\w\s?&.\/;#~%"=-]*>))/ig;
                elm.html(elm.html().replace(re,'<a href="$1" rel="nofollow">$1</a>'));
                var re = /((magnet):[\w?=&.\/-;#@~%+-]+)/ig;
                elm.html(elm.html().replace(re,'<a href="$1">$1</a>'));
            }
        });
    },

    /**
     * Display an error message
     * (We use the same function for paste and reply to comments)
     * //TODO: do we really want to display the status message in two places when there's a comment being posted?
     */
    showError: function (message) {
        $('div#status').addClass('alert-error').text(message).show();
        $('div#replystatus').addClass('alert-error').text(message).show();
    },

    /**
     * Display status
     * (We use the same function for paste and reply to comments)
     *
     * @param string message : text to display
     * @param boolean spin (optional) : tell if the "spinning" animation should be displayed.
     */
    showStatus: function (message, spin) {
        $('div#replystatus').removeClass('alert-error').text(message).show();
        $('div#status').removeClass('alert-error').text(message).show();
        if (!message) {
            $('div#status').html('').hide();
            $('div#replystatus').html('').hide();
            return;
        }
        if (spin) {
            var img = '<img src="img/busy.gif" style="width:16px;height:9px;margin:0px 4px 0px 0px;" />';
            $('div#status').prepend(img);
            $('div#replystatus').prepend(img);
        }
    },

    //if we are not running as a chrome extension, hide the host input
    is_extension: function(){
        return typeof chrome !== undefined && chrome.tabs !== undefined;
    }

};

var Message = Backbone.Model.extend({
  defaults: {
    data: '', // in view mode: the base64 encoded and encrypted contents of the message; in preview mode: the plaintext
    meta: {
        language: 'none',
        postdate: 0
    }
  }
});

var Messages = Backbone.Collection.extend({
  model: Message
});

var GlobalState = Backbone.Model.extend({
  defaults: {
    remote: false,
    server: '',
    preview: false,
    key: '',
    clone_attachment: false,
    messages: new Messages()
  }
});

var ReadPage = Backbone.View.extend({
    id: 'read-page',
    template: _.template($('#read-page-tpl').html()),
    events: {
        'click .paste-url': 'paste_click',
        'click .reply-btn': 'open_reply',
        'click #newbutton': 'new_btn',
        'click #clonebutton': 'clone_btn'
    },

    new_btn: function(e){
        controller.new_paste();
    },

    /**
     * Clone the current paste.
     */
    clone_btn: function(e){
        controller.clone_paste();
    },

    /**
     * Open the comment entry when clicking the "Reply" button of a comment.
     * @param object source : element which emitted the event.
     * @param string commentid = identifier of the comment we want to reply to.
     */
    open_reply: function (e) {
        var source = $(e.target);
        var commentid = source.attr('commentid');
        $('div.reply').remove(); // Remove any other reply area.
        var reply_box_tpl = _.template($('#reply-box-tpl').html());
        var html = reply_box_tpl();
        source.after(html);
        $('#replybutton').click(function(e){
            // Do not send if no data.
            if ($('#replymessage').val().length===0) {
                return;
            }

            util.showStatus('Sending comment...', true);
            var cipherdata = util.zeroCipher(globalState.get('key'), $('textarea#replymessage').val());
            var ciphernickname = '';
            var nick=$('input#nickname').val();
            if (nick !== '') {
                ciphernickname = util.zeroCipher(globalState.get('key'), nick);
            }
            var data_to_send = { data:cipherdata,
                                 parentid: commentid,
                                 pasteid:  globalState.get('pasteid'),
                                 nickname: ciphernickname
                               };

            $.post(util.scriptLocation(), data_to_send, 'json')
            .error(function() {
                util.showError('Error: Comment could not be sent.');
            })
            .success(function(data) {
                if (data.status == 0) {
                    util.showStatus('Comment posted.');
                    location.reload();
                }
                else if (data.status==1) {
                    util.showError('Error: Could not post comment: '+data.message);
                }
                else {
                    util.showError('Error: Could not post comment.');
                }
            });
            e.preventDefault();
        });
        $('#replymessage').focus();
    },

    paste_click: function(){
        location.reload();
    },

    /**
     * Show decrypted text in the display area, including discussion (if open)
     *
     * @param string key : decryption key
     * @param array comments : Array of messages to display (items = array with keys ('data','meta')
     */
    displayMessages: function () {
        var pasteid = globalState.get('pasteid');
        var key = globalState.get('key');
        var comments = globalState.get('messages').toJSON(),
            paste = comments[0];
        comments = _.rest(comments);
        if(!globalState.get('preview')) {
            try { // Try to decrypt the paste.
                paste.data = util.zeroDecipher(key, paste.data);
                // store the plaintext so that we can clone without decrypting again
                globalState.get('messages').at(0).set('data', paste.data);
                if(paste.attachment) {
                    paste.attachment = util.zeroDecipher(key, paste.attachment);
                    // store the plaintext so that we can clone without special cases
                    globalState.get('messages').at(0).set('attachment', paste.attachment);
                }
            } catch(err) {
                $('#cleartext').hide();
                util.showError('Could not decrypt data (Wrong key ?)');
                return;
            }
        }

        if(paste.attachment) {
            $('#attachment').show();
            $('#attachment a').click(function(){
                window.open(paste.attachment, '_blank');
                window.focus();
            });
        }

        util.setElementText($('#cleartext'), paste.data);
        util.urls2links($('#cleartext')); // Convert URLs to clickable links.
        $('#cleartext').snippet(paste.meta.language, {style:"ide-codewarrior"});
        // Display paste expiration.
        if (paste.meta.expire_date) {
            $('#remainingtime')
                .html('<i class="icon-time"></i> This document will expire in '+util.secondsToHuman(paste.meta.remaining_time)+'.')
                .show();
        }
        if (paste.meta.burnafterreading) {
            $('#remainingtime')
                .addClass('alert-error')
                .html('<i class="icon-fire"></i> <strong>FOR YOUR EYES ONLY.</strong> Don\'t close this window, this message will self destruct.')
                .show();
        }

        // Decryption and tree building phase
        if (paste.meta.opendiscussion) {
            var comments_hierarchy = paste;
            var comments_by_id = {};
            comments_by_id[pasteid] = comments_hierarchy;
            for (var i = 0; i < comments.length; i++) {
                var comment=comments[i];
                try {
                    comment.data = util.zeroDecipher(key, comment.data);
                } catch(err) {
                    comment.data = '[decryption failed - wrong key?]';
                }
                if(comment.meta.nickname){
                    try {
                        comment.meta.nickname = util.zeroDecipher(key, comment.meta.nickname);
                    } catch(err) {
                        comment.meta.nickname = '[decryption failed - wrong key?]';
                    }
                } else {
                    comment.meta.nickname = 'Anonymous';
                }
                if(comments_by_id[comment.meta.parentid]){
                    comments_by_id[comment.meta.parentid].children = comments_by_id[comment.meta.parentid].children || [];
                    comments_by_id[comment.meta.parentid].children.push(comment);
                    comments_by_id[comment.meta.commentid] = comment;
                }
            }

            // Display the discussion.
            var comment_tpl = _.template($('#comment-tpl').html());
            var html = '';
            _.each(comments_hierarchy.children, function(ele, i, list) {
                html += comment_tpl({comment: ele, template: comment_tpl});
            });
            $('#comments').html(html);
            // Convert URLs to clickable links in comment.
            util.urls2links($('#comments').find('div.commentdata'));
            $('div#discussion').show();
        }

    },
    render: function(){
        this.$el.html(this.template({
            preview: globalState.get('preview'),
            opendiscussion: globalState.get('messages').at(0).get('meta').opendiscussion,
            pastelink: util.scriptLocation() + "#read!" + globalState.get('pasteid') + '!' + globalState.get('key'),
            pasteid: globalState.get('pasteid')
        }));
        $('#app').empty();
        this.$el.appendTo('#app');
        if (globalState.get('preview')) {
            util.showStatus(false);
        }
        this.displayMessages();
        this.delegateEvents();
    }
});


var NewPage = Backbone.View.extend({
    id: 'send-page',
    template: _.template($('#send-page-tpl').html()),
    events: {
        'change #pasteExpiration': 'changePasteExpiration',
        'click #sendbutton': 'sendData',
        'click .fileupload-exists': 'removeAttachment'
    },
    /**
     * Remove the current attachment (either copied from another paste and in the file selector)
     */
    removeAttachment: function() {
        $('#cloned-file').hide();
        $('#file-wrap').show();
    },

    changePasteExpiration: function(e) {
        if ($(e.target).val() == 'burn') {
            this.$('#opendiscussion').attr('disabled', true).attr('checked', false);
        }
        else {
            this.$('#opendiscussion').attr('disabled', false);
        }
    },

    uploadPaste: function (cipherdata, cipherdata_attachment, expire, language, opendiscussion, key) {
        if($('#server').val()){
            globalState.set('remote', true);
            globalState.set('server', $('#server').val());
        }
        var data_to_send = { data:           cipherdata,
                             attachment:     cipherdata_attachment,
                             expire:         expire,
                             language:       language,
                             opendiscussion: opendiscussion
                           };
        $.post(util.scriptLocation(), data_to_send, 'json')
        .error(function() {
            util.showError('Data could not be sent (server error or not responding).');
        })
        .success(function(data) {
            if (data.status === 0) {
                controller.preview(data.id, key);
            }
            else if (data.status==1) {
                util.showError('Could not create paste - '+data.message);
            }
            else {
                util.showError('Could not create paste.');
            }
        });
    },

    /**
     *  Send a new paste to server
     */
    sendData: function() {
        var cipherdata, reader, attachment, randomkey, files, expiration, language, opendiscussion, plaintext;
        if (globalState.get('clone_attachment')) {
            attachment = globalState.get('messages').at(0).get('attachment');
        }
        // Do not send if no data.
        files = this.$('#file')[0].files; // FileList object
        plaintext = this.$('#messageValue').val();
        if (plaintext.length === 0 && !(files && files[0]) && !attachment) {
            return;
        }

        util.showStatus('Sending paste...', true);

        expiration = this.$('#pasteExpiration').val();
        language = this.$('#language').val();
        opendiscussion = this.$('#opendiscussion').is(':checked') ? 1 : 0;
        randomkey = sjcl.codec.base64.fromBits(sjcl.random.randomWords(8, 0), 0);
        cipherdata = util.zeroCipher(randomkey, plaintext);

        globalState.get('messages').reset([{
            data: plaintext,
            meta: {
                language: language,
                postdate: +new Date()
            }
        }]);

        if (files && files[0]) {
            reader = new FileReader();
            reader.onload = _.bind(function(e) {
                globalState.get('messages').at(0).set('attachment', e.target.result);
                this.uploadPaste(
                    cipherdata,
                    util.zeroCipher(randomkey, e.target.result),
                    expiration,
                    language,
                    opendiscussion,
                    randomkey
                );
            }, this);
            reader.readAsDataURL(files[0]);
        }
        else if(globalState.get('clone_attachment')) {
            console.log(attachment);
            globalState.get('messages').at(0).set('attachment', attachment);
            this.uploadPaste(cipherdata,
                util.zeroCipher(randomkey, attachment),
                expiration,
                language,
                opendiscussion,
                randomkey);
        }
        else {
            this.uploadPaste(
                cipherdata,
                undefined,
                expiration,
                language,
                opendiscussion,
                randomkey
            );
        }

    },

    render: function() {
        util.showStatus(false);
        this.$el.html(this.template({is_extension: util.is_extension()}));
        $('#app').empty();
        this.$el.appendTo('#app');
        this.delegateEvents();
        this.$('#messageValue').focus();
    }
});

var controller = {
    read: function(paste, key){
        // Missing decryption key in URL ?
        if (key.length === 0) {
            util.showError('Error: Cannot decrypt paste - Decryption key missing in URL.');
            return;
        }
        key = util.cleanKey(key);

        $.get(util.scriptLocation()+'?'+paste)
        .error(function() {
            util.showError('Failed to fetch paste.');
            return;
        })
        .success(_.bind(function(msgs){
            try{
                msgs = jQuery.parseJSON(msgs);
            } catch(e) {
                util.showError('Cound not parse response from server');
                return;
            }
            if(msgs.error){
                util.showError(msgs.error);
            } else {
                globalState.set('pasteid', paste);
                globalState.set('key', key);
                globalState.set('preview', false);
                globalState.get('messages').reset(msgs);
                readPage.render();
            }
        }, this));

        if (globalState.get('remote')) {
            zerobinRouter.navigate('remote!' + globalState.get('server') + '!' + paste + '!' + key);
        } else {
            zerobinRouter.navigate('read!' + paste + '!' + key);
        }
    },
    remote: function(server, paste, key) {
        globalState.set('remote', true);
        globalState.set('server', server);
        controller.read(paste, key);
    },
    clone_paste: function(){
        var paste = globalState.get('pasteid');
        var key = globalState.get('key');
        var data = globalState.get('messages').at(0).get('data');
        var has_attachment = !!globalState.get('messages').at(0).get('attachment');
        newPage.render();

        if (has_attachment) {
            globalState.set('clone_attachment', true);
            $('#file-wrap').hide();
            $('#cloned-file-wrap').show().find('a').click(function(){
                globalState.set('clone_attachment', false);
                $('#cloned-file-wrap').hide();
                $('#file-wrap').show();
            });
        }
        $('#messageValue').val(data);
        zerobinRouter.navigate('');
    },
    preview: function(paste, key){
        globalState.set('pasteid', paste);
        globalState.set('key', key);
        globalState.set('preview', true);
        readPage.render();
        if (globalState.get('remote')) {
            zerobinRouter.navigate('remote!' + globalState.get('server') + '!' + paste + '!' + key);
        } else {
            zerobinRouter.navigate('read!' + paste + '!' + key);
        }
    },
    new_paste: function(){
        newPage.render();
        zerobinRouter.navigate('');
    }
};


var ZerobinRouter = Backbone.Router.extend({

    routes: {
        "":                           "new_paste",
        "remote!*server!*paste!*key": "remote_paste",
        "read!*paste!*key":           "read_paste"
    },

    new_paste: function() {
        controller.new_paste();
    },

    // Display an existing paste (from a remote server / in an extension)
    remote_paste: function(server, paste, key) {
        if (server.length !== 0 && paste && paste.length !== 0) {
            controller.remote(server, paste, key);
        } else {
            controller.new_paste();
        }
    },

    // Display an existing paste (from our server)
    read_paste: function(paste, key) {
        if (paste.length !== 0) {
            controller.read(paste, key);
        } else {
            controller.new_paste();
        }
    }
});

var readPage, newPage, zerobinRouter, globalState;

$(function() {
    globalState = new GlobalState();
    readPage = new ReadPage();
    newPage = new NewPage();
    zerobinRouter = new ZerobinRouter();
    Backbone.history.start();
});