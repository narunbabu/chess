package com.chess99.data.api

import com.google.gson.JsonNull
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Production crash guard.
 *
 * Every hand-rolled parser in the data layer navigates Gson through these
 * helpers. Before they existed, a `null` element or a number-as-string in an
 * API response threw, and after R8 obfuscation the user saw text like
 * "I5.n cannot be cast to I5.q". These tests feed the helpers exactly the
 * malformed shapes the live API has produced and assert they degrade to null.
 */
class JsonSafeTest {

    private fun json(raw: String): JsonObject = JsonParser.parseString(raw).asJsonObject

    @Test
    fun `well-formed fields are read normally`() {
        val obj = json("""{"name":"Rita","rating":1450,"win_rate":51.5,"is_bot":true}""")

        assertEquals("Rita", obj.str("name"))
        assertEquals(1450, obj.int("rating"))
        assertEquals(51.5, obj.dbl("win_rate")!!, 0.001)
        assertEquals(true, obj.bool("is_bot"))
    }

    @Test
    fun `a missing key yields null instead of throwing`() {
        val obj = json("""{"name":"Rita"}""")

        assertNull(obj.str("nickname"))
        assertNull(obj.int("rating"))
        assertNull(obj.dbl("win_rate"))
        assertNull(obj.bool("is_bot"))
    }

    @Test
    fun `an explicit JSON null yields null`() {
        val obj = json("""{"rating":null,"name":null,"win_rate":null,"is_bot":null}""")

        assertNull(obj.int("rating"))
        assertNull(obj.str("name"))
        assertNull(obj.dbl("win_rate"))
        assertNull(obj.bool("is_bot"))
    }

    @Test
    fun `a numeric field returned as a string is still parsed`() {
        // Laravel occasionally serialises decimals and bigints as strings.
        val obj = json("""{"rating":"1450","win_rate":"51.5"}""")

        assertEquals(1450, obj.int("rating"))
        assertEquals(51.5, obj.dbl("win_rate")!!, 0.001)
    }

    @Test
    fun `a non numeric string does not crash the numeric readers`() {
        val obj = json("""{"rating":"unrated","win_rate":"n/a"}""")

        assertNull(obj.int("rating"))
        assertNull(obj.dbl("win_rate"))
    }

    @Test
    fun `an object or array where a scalar was expected yields null`() {
        val obj = json("""{"rating":{"current":1450},"name":["Rita"],"is_bot":{"value":true}}""")

        assertNull(obj.int("rating"))
        assertNull(obj.str("name"))
        assertNull(obj.bool("is_bot"))
    }

    @Test
    fun `reading from a null receiver yields null`() {
        val absent: JsonObject? = null

        assertNull(absent.str("name"))
        assertNull(absent.int("rating"))
        assertNull(absent.dbl("win_rate"))
        assertNull(absent.bool("is_bot"))
    }

    @Test
    fun `objOrNull and arrOrNull reject the wrong shape`() {
        val payload = json("""{"game":{"id":7},"moves":[1,2,3],"note":"text"}""")

        assertEquals(7, payload.get("game").objOrNull().int("id"))
        assertEquals(3, payload.get("moves").arrOrNull()!!.size())

        assertNull("a string is not an object", payload.get("note").objOrNull())
        assertNull("an object is not an array", payload.get("game").arrOrNull())
        assertNull("a missing key is neither", payload.get("missing").objOrNull())
        assertNull(JsonNull.INSTANCE.objOrNull())
        assertNull((null as com.google.gson.JsonElement?).arrOrNull())
    }

    @Test
    fun `a game history array containing a null entry can still be walked`() {
        // The exact production payload shape that used to crash Game History.
        val payload = json("""{"data":[{"id":1},null,{"id":3},"oops"]}""")

        val ids = payload.get("data").arrOrNull()!!.mapNotNull { it.objOrNull().int("id") }

        assertEquals(listOf(1, 3), ids)
    }

    @Test
    fun `boolean-ish values from the API are read consistently`() {
        val obj = json("""{"a":true,"b":false,"c":"true","d":"false"}""")

        assertEquals(true, obj.bool("a"))
        assertEquals(false, obj.bool("b"))
        assertEquals("Laravel serialises some flags as strings", true, obj.bool("c"))
        assertEquals(false, obj.bool("d"))
    }
}
