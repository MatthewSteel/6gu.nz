--
-- PostgreSQL database dump
--

-- Dumped from database version 10.4
-- Dumped by pg_dump version 10.4 (Ubuntu 10.4-2.pgdg16.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: sheets_user_dev
--

CREATE TABLE public.documents (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    createdAt timestamp without time zone DEFAULT timezone('utc'::text, now()),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    modifiedAt timestamp without time zone DEFAULT timezone('utc'::text, now()),
    updateId uuid DEFAULT public.gen_random_uuid() NOT NULL,
    userId uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.documents OWNER TO sheets_user_dev;

--
-- Name: users; Type: TABLE; Schema: public; Owner: sheets_user_dev
--

CREATE TABLE public.users (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    signupAt timestamp without time zone DEFAULT timezone('utc'::text, now()),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    lastSeenAt timestamp without time zone DEFAULT timezone('utc'::text, now())
);


ALTER TABLE public.users OWNER TO sheets_user_dev;

--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: sheets_user_dev
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sheets_user_dev
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: documents documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sheets_user_dev
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_userId_fkey FOREIGN KEY (userId) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

