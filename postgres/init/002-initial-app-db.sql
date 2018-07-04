--
-- PostgreSQL database dump
--

-- Dumped from database version 10.4 (Debian 10.4-2.pgdg90+1)
-- Dumped by pg_dump version 10.4 (Debian 10.4-2.pgdg90+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: sheets_user_dev
--

CREATE TABLE "public"."documents" (
    "id" "uuid" DEFAULT "public"."gen_random_uuid"() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "modifiedAt" timestamp without time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updateId" "uuid" DEFAULT "public"."gen_random_uuid"() NOT NULL,
    "userId" "uuid" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "prettyId" character varying(16) NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "sheets_user_dev";

--
-- Name: session; Type: TABLE; Schema: public; Owner: sheets_user_dev
--

CREATE TABLE "public"."session" (
    "sid" character varying NOT NULL,
    "sess" "json" NOT NULL,
    "expire" timestamp(6) without time zone NOT NULL
);


ALTER TABLE "public"."session" OWNER TO "sheets_user_dev";

--
-- Name: users; Type: TABLE; Schema: public; Owner: sheets_user_dev
--

CREATE TABLE "public"."users" (
    "id" "uuid" DEFAULT "public"."gen_random_uuid"() NOT NULL,
    "isAdmin" "boolean" DEFAULT FALSE NOT NULL,
    "signupAt" timestamp without time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "lastSeenAt" timestamp without time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "providerName" character varying NOT NULL,
    "providerUserId" character varying NOT NULL,
    "lastViewedDocumentId" "uuid"
);


ALTER TABLE "public"."users" OWNER TO "sheets_user_dev";

--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: sheets_user_dev
--

ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: sheets_user_dev
--

ALTER TABLE ONLY "public"."session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sheets_user_dev
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: docs_prettyId_index; Type: INDEX; Schema: public; Owner: sheets_user_dev
--

CREATE UNIQUE INDEX "docs_prettyId_index" ON "public"."documents" USING "btree" ("prettyId");


--
-- Name: user_provider_details_index; Type: INDEX; Schema: public; Owner: sheets_user_dev
--

CREATE UNIQUE INDEX "user_provider_details_index" ON "public"."users" USING "btree" ("providerName", "providerUserId");


--
-- Name: documents documents_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sheets_user_dev
--

ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_userid_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: users users_lastvieweddocumentid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sheets_user_dev
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_lastvieweddocumentid_fkey" FOREIGN KEY ("lastViewedDocumentId") REFERENCES "public"."documents"("id") ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

