/**
 * ZeroBin
 *
 * a zero-knowledge paste bin
 *
 * @link      http://sebsauvage.net/wiki/doku.php?id=php:zerobin
 * @copyright 2012 Sébastien SAUVAGE (sebsauvage.net)
 * @license   http://www.opensource.org/licenses/zlib-license.php The zlib/libpng License
 * @version   0.15
 */

// Immediately start random number generator collector.
sjcl.random.startCollectors();

// Change template strings for underscore templating
_.templateSettings = {
  evaluate : /\{\{\!(.+?)\}\}/g,
  interpolate : /\{\{\{(.+?)\}\}\}/g,
  escape : /\{\{(?!\{)(?!\!)(.+?)\}\}/g
};

/**
 *  Converts a duration (in seconds) into human readable format.
 *
 *  @param int seconds
 *  @return string
 */
function secondsToHuman(seconds)
{
    if (seconds<60) { var v=Math.floor(seconds); return v+' second'+((v>1)?'s':''); }
    if (seconds<60*60) { var v=Math.floor(seconds/60); return v+' minute'+((v>1)?'s':''); }
    if (seconds<60*60*24) { var v=Math.floor(seconds/(60*60)); return v+' hour'+((v>1)?'s':''); }
    // If less than 2 months, display in days:
    if (seconds<60*60*24*60) { var v=Math.floor(seconds/(60*60*24)); return v+' day'+((v>1)?'s':''); }
    var v=Math.floor(seconds/(60*60*24*30)); return v+' month'+((v>1)?'s':'');
}

/**
 * Compress a message (deflate compression). Returns base64 encoded data.
 *
 * @param string message
 * @return base64 string data
 */
function compress(message) {
    return Base64.toBase64( RawDeflate.deflate( Base64.utob(message) ) );
}

/**
 * Decompress a message compressed with compress().
 */
function decompress(data) {
    return Base64.btou( RawDeflate.inflate( Base64.fromBase64(data) ) );
}

/**
 * Compress, then encrypt message with key.
 *
 * @param string key
 * @param string message
 * @return encrypted string data
 */
function zeroCipher(key, message) {
    return sjcl.encrypt(key,compress(message));
}
/**
 *  Decrypt message with key, then decompress.
 *
 *  @param key
 *  @param encrypted string data
 *  @return string readable message
 */
function zeroDecipher(key, data) {
    return decompress(sjcl.decrypt(key,data));
}

/**
 * @return the current script location (without search or hash part of the URL).
 *   eg. http://server.com/zero/?aaaa#bbbb --> http://server.com/zero/
 */
function scriptLocation() {
    return window.location.href.substring(0,window.location.href.length
               -window.location.search.length -window.location.hash.length);
}

/**
 * @return the paste unique identifier from the URL
 *   eg. 'c05354954c49a487'
 */
function pasteID() {
    return window.location.search.substring(1);
}

/**
 * Set text of a DOM element (required for IE)
 * This is equivalent to element.text(text)
 * @param object element : a DOM element.
 * @param string text : the text to enter.
 */
function setElementText(element, text) {
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
}

/**
 * Remove the current attachment (either copied from another paste and in the file selector)
 */
function remove_attachment() {
    $('#cloned-file').hide();
    $('#attachment a').attr('href', ''); // removes the saved decrypted file data
    $('#file-wrap').show();
}


/**
 * Open the comment entry when clicking the "Reply" button of a comment.
 * @param object source : element which emitted the event.
 * @param string commentid = identifier of the comment we want to reply to.
 */
function open_reply(source, commentid) {
    $('div.reply').remove(); // Remove any other reply area.
    source.after('<div class="row">'
                + '<div class="span8 offset2">'
                + '<div class="reply">'
                + '<div id="replystatus" class="alert" style="display:none;">&nbsp;</div>'
                + '<form class="form-horizontal well"><fieldset>'
                + '<div class="control-group">'
                + '<label class="control-label" for="nickname">Optional Name</label>'
                + '<div class="controls">'
                + '<input type="text" class="input-xlarge" id="nickname" name="nickname"/>'
                + '</div>'
                + '</div>'
                + '<div class="control-group">'
                + '<label class="control-label" for="replymessage">Comment</label>'
                + '<div class="controls">'
                + '<textarea id="replymessage" class="replymessage input-xlarge" rows="7"></textarea>'
                + '</div>'
                + '</div>'
                + '<div class="control-group">'
                + '<div class="controls">'
                + '<button class="btn btn-primary" id="replybutton" onclick="send_comment(\'' + commentid + '\');return false;">Post comment</button>'
                + '</div>'
                + '</div>'
                + '</div>'
                + '</fieldset></form></div></div>');
    $('input#nickname').focus(function() {
        if ($(this).val() == $(this).attr('title')) {
            $(this).val('');
        }
    });
    $('textarea#replymessage').focus();
}

/**
 * Send a reply in a discussion.
 * @param string parentid : the comment identifier we want to send a reply to.
 */
function send_comment(parentid) {
    // Do not send if no data.
    if ($('#replymessage').val().length===0) {
        return;
    }

    showStatus('Sending comment...', spin=true);
    var cipherdata = zeroCipher(globalState.get('key'), $('textarea#replymessage').val());
    var ciphernickname = '';
    var nick=$('input#nickname').val();
    if (nick !== '') {
        ciphernickname = zeroCipher(globalState.get('key'), nick);
    }
    var data_to_send = { data:cipherdata,
                         parentid: parentid,
                         pasteid:  globalState.get('pasteid'),
                         nickname: ciphernickname
                       };

    $.post(scriptLocation(), data_to_send, 'json')
        .error(function() {
            showError('Error: Comment could not be sent.');
        })
        .success(function(data) {
            if (data.status == 0) {
                showStatus('Comment posted.');
                location.reload();
            }
            else if (data.status==1) {
                showError('Error: Could not post comment: '+data.message);
            }
            else {
                showError('Error: Could not post comment.');
            }
        });
    }



// /**
//  * Clone the current paste.
//  */
// function clonePaste() {
//     stateNewPaste();
//     showStatus('');
//     if($('#attachment a').attr('href')){
//         $('#cloned-file').removeClass('hidden');
//         $('#file-wrap').addClass('hidden');
//     }
//     $('textarea#message').text($('pre#cleartext').text());
// }

/**
 * Display an error message
 * (We use the same function for paste and reply to comments)
 */
function showError(message) {
    $('div#status').addClass('alert-error').text(message);
    $('div#replystatus').addClass('alert-error').text(message);
    $('div#status').show();
    $('div#replystatus').show();
}

/**
 * Display status
 * (We use the same function for paste and reply to comments)
 *
 * @param string message : text to display
 * @param boolean spin (optional) : tell if the "spinning" animation should be displayed.
 */
function showStatus(message, spin) {
    $('div#replystatus').removeClass('alert-error');
    $('div#replystatus').text(message);
    $('div#status').removeClass('alert-error');
    $('div#status').text(message);
    if (!message || message == '') {
        $('div#status').html('&nbsp');
        $('div#status').hide();
        $('div#replystatus').html('&nbsp');
        $('div#replystatus').hide();
        return;
    }

    $('div#status').show();

    if (spin) {
        var img = '<img src="img/busy.gif" style="width:16px;height:9px;margin:0px 4px 0px 0px;" />';
        $('div#status').prepend(img);
        $('div#replystatus').prepend(img);
    }
}

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
function urls2links(element) {
    var re = /((http|https|ftp):\/\/[\w?=&.\/-;#@~%+-]+(?![\w\s?&.\/;#~%"=-]*>))/ig;
    element.html(element.html().replace(re,'<a href="$1" rel="nofollow">$1</a>'));
    var re = /((magnet):[\w?=&.\/-;#@~%+-]+)/ig;
    element.html(element.html().replace(re,'<a href="$1">$1</a>'));
}

// Some stupid web 2.0 services and redirectors add data AFTER the anchor
// (such as &utm_source=...).
// We will strip any additional data.
function cleanKey(key) {
    // First, strip everything after the equal sign (=) which signals end of base64 string.
    i = key.indexOf('='); if (i>-1) { key = key.substring(0,i+1); }

    // If the equal sign was not present, some parameters may remain:
    i = key.indexOf('&'); if (i>-1) { key = key.substring(0,i); }

    // Then add trailing equal sign if it's missing
    if (key.charAt(key.length-1)!=='=') key+='=';

    return key;
}

var Message = Backbone.Model.extend({
  defaults: {
    data: '',
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
    preview: false,
    key: '',
    attachment: false,
    messages: new Messages()
  }
});

var ReadPage = Backbone.View.extend({
    id: 'read-page',
    template: _.template($('#read-page-tpl').html()),

    /**
     * Show decrypted text in the display area, including discussion (if open)
     *
     * @param string key : decryption key
     * @param array comments : Array of messages to display (items = array with keys ('data','meta')
     */
    displayMessages: function () {
        var pasteid = globalState.get('pasteid');
        var key = globalState.get('key');
        var comments = globalState.get('messages').toJSON();
        var attachment = comments[0].attachment, cleartext = comments[0].data;
        if(!globalState.get('preview')) {
            try { // Try to decrypt the paste.
                cleartext = zeroDecipher(key, cleartext);
                if(attachment) {
                    attachment = zeroDecipher(key, attachment);
                }
            } catch(err) {
                $('#cleartext').hide();
                showError('Could not decrypt data (Wrong key ?)');
                return;
            }
        }

        if(attachment) {
            $('#attachment').show();
            $('#attachment a').attr('href', attachment);
        }

        setElementText($('pre#cleartext'), cleartext);
        urls2links($('pre#cleartext')); // Convert URLs to clickable links.
        $('pre#cleartext').snippet(comments[0].meta.language, {style:"ide-codewarrior"});
        // Display paste expiration.
        if (comments[0].meta.expire_date) {
            $('div#remainingtime')
                .html('<i class="icon-time"></i> This document will expire in '+secondsToHuman(comments[0].meta.remaining_time)+'.')
                .show();
        }
        if (comments[0].meta.burnafterreading) {
            $('div#remainingtime')
                .addClass('alert-error')
                .html('<i class="icon-fire"></i> <strong>FOR YOUR EYES ONLY.</strong> Don\'t close this window, this message will self destruct.')
                .show();
        }

        // If the discussion is opened on this paste, display it.
        if (comments[0].meta.opendiscussion) {
            $('div#comments').html('');
            // For each comment.
            for (var i = 1; i < comments.length; i++) {
                var comment=comments[i];
                var cleartext="[Could not decrypt comment ; Wrong key ?]";
                try {
                    cleartext = zeroDecipher(key, comment.data);
                } catch(err) { }
                var place = $('div#comments');
                // If parent comment exists, display below (CSS will automatically shift it right.)
                var cname = 'div#comment_'+comment.meta.parentid

                // If the element exists in page
                if ($(cname).length) {
                    place = $(cname);
                }

                var divComment = $('<blockquote><div class="comment" id="comment_' + comment.meta.commentid+'">'
                                   + '<div class="commentmeta"><strong class="nickname"></strong><span class="commentdate"></span></div><div class="commentdata"></div>'
                                   + '<button class="btn" onclick="open_reply($(this),\'' + comment.meta.commentid + '\');return false;">Reply</button>'
                                   + '</div></blockquote>');
                setElementText(divComment.find('div.commentdata'), cleartext);
                // Convert URLs to clickable links in comment.
                urls2links(divComment.find('div.commentdata'));
                divComment.find('strong.nickname').html('<i>(Anonymous)</i>');

                // Try to get optional nickname:
                try {
                    divComment.find('strong.nickname').text(zeroDecipher(key, comment.meta.nickname));
                } catch(err) { }
                divComment.find('span.commentdate').text(' - '+(new Date(comment.meta.postdate*1000).toUTCString())+' ').attr('title','CommentID: ' + comment.meta.commentid);

                // If an avatar is available, display it.
                if (comment.meta.vizhash) {
                    divComment.find('strong.nickname').before('<img src="' + comment.meta.vizhash + '" class="vizhash" title="Anonymous avatar (Vizhash of the IP address)" />');
                }

                place.append(divComment);
            }
            $('div#comments').append('<div class="comment"><button class="btn" onclick="open_reply($(this),\'' + pasteid + '\');return false;">Add comment</button></div>');
            $('div#discussion').show();
        }
    },
    render: function(){
        this.$el.html(this.template({
            preview: globalState.get('preview'),
            opendiscussion: globalState.get('messages').at(0).get('meta').opendiscussion,
            pastelink: scriptLocation() + "read!" + globalState.get('pasteid') + '!' + globalState.get('key')
        }));
        $('#app').empty();
        this.$el.appendTo('#app');
        this.delegateEvents();
        if (globalState.get('preview')) {
            showStatus('');
        }

        this.displayMessages();
    }
});


var NewPage = Backbone.View.extend({
    id: 'send-page',
    template: _.template($('#send-page-tpl').html()),
    events: {
        'change #pasteExpiration': 'changePasteExpiration',
        'click #sendbutton': 'send_data'
    },
    changePasteExpiration: function(e) {
        if ($(e.target).val() == 'burn') {
            this.$('#opendiscussion').attr('disabled', true).attr('checked', false);
        }
        else {
            this.$('#opendiscussion').attr('disabled', false);
        }
    },

    upload_paste: function (cipherdata, cipherdata_attachment, expire, language, opendiscussion, key) {
        var data_to_send = { data:           cipherdata,
                             attachment:     cipherdata_attachment,
                             expire:         expire,
                             language:       language,
                             opendiscussion: opendiscussion
                           };
        $.post(scriptLocation(), data_to_send, 'json')
        .error(function() {
            showError('Data could not be sent (server error or not responding).');
        })
        .success(function(data) {
            if (data.status === 0) {
                controller.preview(data.id, key);
            }
            else if (data.status==1) {
                showError('Could not create paste - '+data.message);
            }
            else {
                showError('Could not create paste.');
            }
        });
    },

    /**
     *  Send a new paste to server
     */
    send_data: function() {
        var cipherdata, reader, randomkey, files, expiration, language, opendiscussion, plaintext;
        // Do not send if no data.
        files = this.$('#file')[0].files; // FileList object
        plaintext = this.$('#messageValue').val();
        if (plaintext.length === 0 && !(files && files[0])) {
            return;
        }

        showStatus('Sending paste...', spin=true);

        expiration = this.$('#pasteExpiration').val();
        language = this.$('#language').val();
        opendiscussion = this.$('#opendiscussion').is(':checked') ? 1 : 0;
        randomkey = sjcl.codec.base64.fromBits(sjcl.random.randomWords(8, 0), 0);
        cipherdata = zeroCipher(randomkey, plaintext);

        globalState.get('messages').reset([{
            data: plaintext,
            meta: {
                language: language,
                postdate: +new Date()
            }
        }]);

        if(files && files[0]){
            reader = new FileReader();
            reader.onload = _.bind(function(e) {
                globalState.get('messages').at(0).set('attachment', e.target.result);
                this.upload_paste(
                    cipherdata,
                    zeroCipher(randomkey, e.target.result),
                    expiration,
                    language,
                    opendiscussion,
                    randomkey
                );
            }, this);
            reader.readAsDataURL(files[0]);
        }
        // Clone case:
        /* else if($('div#attachment a').attr('href')) {
            the_rest(cipherdata, zeroCipher(randomkey, $('div#attachment a').attr('href')));
        }*/
        else {
            this.upload_paste(
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
        showStatus('');
        this.$el.html(this.template());
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
            showError('Error: Cannot decrypt paste - Decryption key missing in URL.');
            return;
        }
        key = cleanKey(key);

        $.get('?'+paste)
        .error(function() {
            showError('Failed to fetch paste.');
            return;
        })
        .success(_.bind(function(msgs){
            try{
                msgs = jQuery.parseJSON(msgs);
            } catch(e) {
                showError('Cound not parse response from server');
                return;
            }
            if(msgs.error){
                showError(msgs.error);
            } else {
                globalState.set('pasteid', paste);
                globalState.set('key', key);
                globalState.set('preview', false);
                globalState.get('messages').reset(msgs);
                readPage.render();
            }
        }, this));

        zerobinRouter.navigate('read!' + paste + '!' + key);
    },
    preview: function(paste, key){
        globalState.set('pasteid', paste);
        globalState.set('key', key);
        globalState.set('preview', true);
        readPage.render();
    },
    new_paste: function(){
        newPage.render();
        zerobinRouter.navigate('');
    }
};


var ZerobinRouter = Backbone.Router.extend({

    routes: {
        "":                          "new_paste",
        "read!*paste!*key":          "read_paste"
    },

    new_paste: function() {
        controller.new_paste();
    },

    // Display an existing paste
    read_paste: function(paste, key) {
        if (paste.length !== 0) {
            // Show proper elements on screen.
            controller.read(paste, key);
        } else {
            controller.new_paste();
        }
    }
});

var readPage, newPage, zerobinRouter;

$(function() {
    globalState = new GlobalState();
    readPage = new ReadPage();
    newPage = new NewPage();
    zerobinRouter = new ZerobinRouter();
    Backbone.history.start();
});