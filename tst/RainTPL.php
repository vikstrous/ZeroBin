<?php
class RainTPLTest extends PHPUnit_Framework_TestCase
{
    private static $data = '{"iv":"EN39/wd5Nk8HAiSG2K5AsQ","salt":"QKN1DBXe5PI","ct":"8hA83xDdXjD7K2qfmw5NdA"}';

    private static $error = 'foo bar';

    private static $version = 'Version 1.2.3';

    private $_content;

    private $tmp_existed;

    public function setUp()
    {
        $this->tmp_existed = is_dir(PATH.'tmp');
        /* Setup Routine */
        $page = new RainTPL;
        $page::configure(array('cache_dir' => 'tmp/'));
        // We escape it here because ENT_NOQUOTES can't be used in RainTPL templates.
        $page->assign('CIPHERDATA', htmlspecialchars(self::$data, ENT_NOQUOTES));
        $page->assign('ERRORMESSAGE', self::$error);
        $page->assign('OPENDISCUSSION', false);
        $page->assign('VERSION', self::$version);
        ob_start();
        $page->draw('page');
        $this->_content = ob_get_contents();
        // run a second time from cache
        $page->cache('page');
        $page->draw('page');
        ob_end_clean();
    }

    public function tearDown()
    {
        /* Tear Down Routine */
        if(!$this->tmp_existed)
            helper::rmdir(PATH . 'tmp');
    }

    public function testTemplateRendersCorrectly()
    {
        // testing version number in JS address, since other instances may not be present in different templates
        $this->assertTag(
            array(
                'tag' => 'script',
                'attributes' => array(
                    'src' => 'js/zerobin.js?' . rawurlencode(self::$version)
                ),
            ),
            $this->_content,
            'outputs version correctly'
        );
    }
}
